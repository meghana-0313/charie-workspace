// Connected repos: connect a GitHub repo, build it on Cloud Build, deploy
// to Cloud Run, auto-file a ticket, and run the investigation against it.
// The UI polls pollBuild(); each poll advances the state machine one step,
// so no background worker is needed.

import { spawnEngineRun } from "./engine";
import { cloudBuildCreate, cloudBuildStatus, gcpProject, gcsBucket, gcsUpload, runDeployApp } from "./gcp";
import { downloadTarball, getBranchSha, getRepo, getTreePaths, parseRepoUrl, postCommitStatus } from "./github";
import { pushToAll } from "./push";
import { store, uid } from "./store";
import type { RepoBuild, RepoConnection } from "./types";

const REGION = "us-central1";

export function serviceNameFor(repo: RepoConnection): string {
  const slug = `${repo.owner}-${repo.repo}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  return `gqa-${slug || repo.id.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 30)}`;
}

export function imageFor(repo: RepoConnection, sha: string): string {
  return `${REGION}-docker.pkg.dev/${gcpProject()}/ghostqa/${serviceNameFor(repo)}:${sha.slice(0, 12)}`;
}

function nodeDockerfile(startCommand: string): string {
  return [
    "FROM node:22-bookworm-slim",
    "WORKDIR /app",
    "COPY package.json package-lock.json* ./",
    "RUN npm install --omit=dev || npm install",
    "COPY . .",
    "ENV PORT=8080",
    "EXPOSE 8080",
    `CMD ["sh", "-c", "${startCommand.replace(/"/g, '\\"')}"]`,
    "",
  ].join("\n");
}

function pythonDockerfile(startCommand: string): string {
  return [
    "FROM python:3.12-slim",
    "WORKDIR /app",
    "COPY requirements.txt ./",
    "RUN pip install --no-cache-dir -r requirements.txt",
    "COPY . .",
    "ENV PORT=8080",
    "EXPOSE 8080",
    `CMD ["sh", "-c", "${startCommand.replace(/"/g, '\\"')}"]`,
    "",
  ].join("\n");
}

export async function connectRepo(input: { url: string; token?: string; subdir?: string; startCommand?: string }): Promise<RepoConnection> {
  const parsed = parseRepoUrl(input.url);
  if (!parsed) throw new Error("Use a github.com URL or owner/repo");
  const meta = await getRepo(parsed.owner, parsed.repo, input.token);
  if (!meta) throw new Error("Repo not found or token rejected");
  if (meta.visibility === "private" && !input.token) throw new Error("Private repo needs a token");
  const now = new Date().toISOString();
  const repo: RepoConnection = {
    id: uid("repo"),
    owner: parsed.owner,
    repo: parsed.repo,
    branch: meta.defaultBranch,
    subdir: (input.subdir ?? "").trim().replace(/^\//, "").replace(/\/$/, ""),
    startCommand: input.startCommand?.trim() || "npm start",
    visibility: meta.visibility,
    hasToken: Boolean(input.token),
    token: input.token || undefined,
    status: "connected",
    createdAt: now,
    updatedAt: now,
  };
  await store.saveRepo(repo);
  return repo;
}

export type BuildPlan = { strategy: "dockerfile" | "node" | "python"; dockerfile: string | null };

export async function planBuild(repo: RepoConnection, sha: string): Promise<BuildPlan> {
  const paths = await getTreePaths(repo.owner, repo.repo, sha, repo.token);
  if (!paths) throw new Error("Could not list repo files (empty, huge, or token rejected)");
  const inScope = (p: string) => (repo.subdir ? p.startsWith(`${repo.subdir}/`) : true);
  const scoped = paths.filter(inScope).map((p) => (repo.subdir ? p.slice(repo.subdir.length + 1) : p));
  if (scoped.some((p) => p === "Dockerfile" || p === "dockerfile")) return { strategy: "dockerfile", dockerfile: null };
  if (scoped.some((p) => p === "package.json")) return { strategy: "node", dockerfile: nodeDockerfile(repo.startCommand) };
  if (scoped.some((p) => p === "requirements.txt")) return { strategy: "python", dockerfile: pythonDockerfile(repo.startCommand) };
  throw new Error("No Dockerfile, package.json, or requirements.txt in scope - add one");
}

/** Trigger: tarball to GCS, generated Dockerfile if needed, Cloud Build create. */
export async function startBuild(repoId: string): Promise<RepoBuild> {
  const repo = await store.getRepo(repoId);
  if (!repo) throw new Error("Unknown repo");
  if (repo.status === "building") throw new Error("A build is already running for this repo");
  const sha = await getBranchSha(repo.owner, repo.repo, repo.branch, repo.token);
  if (!sha) throw new Error("Could not read branch HEAD (renamed branch or bad token?)");
  const plan = await planBuild(repo, sha);
  const tarball = await downloadTarball(repo.owner, repo.repo, sha, repo.token);
  if (!tarball) throw new Error("Tarball download failed or over 64MB");
  const object = `repo-builds/${repo.id}/${sha}.tgz`;
  await gcsUpload(object, tarball, "application/gzip");

  const context = repo.subdir || ".";
  const image = imageFor(repo, sha);
  const steps: Array<Record<string, unknown>> = [];
  // GitHub tarballs wrap everything in one top-level dir: flatten it first.
  steps.push({
    name: "gcr.io/cloud-builders/docker",
    entrypoint: "sh",
    args: ["-c", 'd=$(ls -d */ | head -1); if [ -n "$d" ]; then mv "$d"* . && rmdir "$d"; fi; ls'],
  });
  if (plan.dockerfile) {
    const dfObject = `repo-builds/${repo.id}/${sha}.Dockerfile`;
    await gcsUpload(dfObject, Buffer.from(plan.dockerfile), "text/plain");
    steps.push({
      name: "gcr.io/cloud-builders/gcloud",
      args: ["storage", "cp", `gs://${gcsBucket()}/${dfObject}`, `${context}/Dockerfile`],
    });
  }
  steps.push({
    name: "gcr.io/cloud-builders/docker",
    args: ["build", "-t", image, context],
  });
  steps.push({ name: "gcr.io/cloud-builders/docker", args: ["push", image] });

  const cloudBuildId = await cloudBuildCreate({
    source: { storageSource: { bucket: gcsBucket(), object } },
    steps,
    images: [image],
    timeout: "1200s",
  });
  const now = new Date().toISOString();
  const build: RepoBuild = {
    id: uid("bld"),
    repoId: repo.id,
    sha,
    cloudBuildId,
    strategy: plan.strategy,
    status: "working",
    createdAt: now,
    updatedAt: now,
  };
  await store.saveBuild(build);
  await store.updateRepo(repo.id, { status: "building", lastSha: sha });
  if (repo.token) {
    await postCommitStatus({
      owner: repo.owner,
      repo: repo.repo,
      sha,
      state: "pending",
      targetUrl: portalBase() ? `${portalBase()}/repos/${repo.id}` : undefined,
      description: "GhostQA build started",
      token: repo.token,
    });
  }
  return build;
}

function portalBase(): string {
  return (process.env.PORTAL_PUBLIC_URL ?? "").replace(/\/$/, "");
}

/** Advance one build: poll Cloud Build, deploy on success, file ticket, run tests. */
export async function pollBuild(buildId: string): Promise<RepoBuild> {
  const build = await store.getBuild(buildId);
  if (!build) throw new Error("Unknown build");
  if (build.status === "deployed" || build.status === "failure" || build.status === "error") return build;
  const repo = await store.getRepo(build.repoId);
  if (!repo) throw new Error("Repo disconnected");

  let remote = "UNKNOWN";
  try {
    remote = await cloudBuildStatus(build.cloudBuildId);
  } catch (e) {
    await store.updateBuild(build.id, { status: "error", detail: `status poll failed: ${(e as Error).message}` });
    await store.updateRepo(repo.id, { status: "failed" });
    return (await store.getBuild(build.id)) as RepoBuild;
  }
  if (remote === "WORKING" || remote === "QUEUED") {
    await store.updateBuild(build.id, { status: "working", detail: `Cloud Build ${remote.toLowerCase()}` });
    return (await store.getBuild(build.id)) as RepoBuild;
  }
  if (remote !== "SUCCESS") {
    await store.updateBuild(build.id, { status: "failure", detail: `Cloud Build ${remote.toLowerCase()}` });
    await store.updateRepo(repo.id, { status: "failed" });
    if (repo.token) {
      await postCommitStatus({
        owner: repo.owner, repo: repo.repo, sha: build.sha, state: "failure",
        targetUrl: portalBase() ? `${portalBase()}/repos/${repo.id}` : undefined,
        description: "GhostQA build failed", token: repo.token,
      });
    }
    return (await store.getBuild(build.id)) as RepoBuild;
  }

  // Build succeeded: deploy, file the ticket, run the investigation.
  await store.updateBuild(build.id, { status: "success", detail: "image pushed, deploying" });
  try {
    const appUrl = await runDeployApp(serviceNameFor(repo), imageFor(repo, build.sha));
    const subject = `Repo build: ${repo.owner}/${repo.repo}@${build.sha.slice(0, 7)}`;
    const goal = `Explore the deployed ${repo.owner}/${repo.repo} build and report functional, usability, and security findings`;
    const ticket = await store.createTicket({
      subject,
      body: `Automated build ${build.id} (${build.strategy}) deployed ${appUrl} from ${repo.owner}/${repo.repo}@${repo.branch}. Investigate the deployed app.`,
      goal,
      targetUrl: appUrl,
      sourceRepo: `${repo.owner}/${repo.repo}`,
    });
    await store.addMessage(ticket.roomId!, {
      authorType: "agent",
      authorName: "GhostQA",
      body: `Build ${build.id} deployed. Starting investigation of ${appUrl}.`,
    });
    const runId = await spawnEngineRun({ targetUrl: appUrl, goal, verify: false });
    await store.createRun({ id: runId, ticketId: ticket.id, roomId: ticket.roomId!, kind: "investigate", targetUrl: appUrl });
    await store.addRunToRoom(ticket.roomId!, runId);
    await store.updateBuild(build.id, { status: "deployed", appUrl, ticketId: ticket.id, detail: "live and under test" });
    await store.updateRepo(repo.id, { status: "live", appUrl, ticketId: ticket.id });
    if (repo.token) {
      await postCommitStatus({
        owner: repo.owner, repo: repo.repo, sha: build.sha, state: "success",
        targetUrl: portalBase() ? `${portalBase()}/tickets/${ticket.id}` : undefined,
        description: "GhostQA deployed + testing", token: repo.token,
      });
    }
    await pushToAll("Repo live and under test", subject, `/tickets/${ticket.id}`);
    return (await store.getBuild(build.id)) as RepoBuild;
  } catch (e) {
    await store.updateBuild(build.id, { status: "error", detail: `deploy/test failed: ${(e as Error).message}` });
    await store.updateRepo(repo.id, { status: "failed" });
    return (await store.getBuild(build.id)) as RepoBuild;
  }
}
