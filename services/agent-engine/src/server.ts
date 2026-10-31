// Engine HTTP service (Cloud Run). Same runs as the CLI, driven over HTTP so
// the portal (a separate container) can trigger and poll them.
//
//   POST /runs                    {targetUrl, goal?, verify?, baselineRunId?} → {runId}
//   GET  /runs/:id                {runId, status, findings?, verification?, report?, error?}
//   GET  /runs/:id/artifacts/<..> report file bytes (screenshots, packets, …)
//   GET  /health                  {ok: true}
//
// Auth: x-engine-token must equal the ENGINE_TOKEN secret. When no token is
// configured (local dev without GCP), auth is skipped with a one-time warning.

import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { GOAL } from "./explorer.js";
import { executeRun } from "./job.js";
import { secret } from "./secrets.js";

export interface ServerOpts {
  reportsRoot: string;
}

type JobState = { status: "running" | "done" | "failed"; error?: string };

const MAX_BODY = 1024 * 1024;

function send(res: ServerResponse, code: number, body: unknown, type = "application/json"): void {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { "content-type": type });
  res.end(data);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function mimeOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "json" || ext === "md") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export function createApp(opts: ServerOpts): RequestListener {
  const jobs = new Map<string, JobState>();
  const root = opts.reportsRoot;
  let warnedNoAuth = false;

  function authorized(req: IncomingMessage): boolean {
    const expected = secret("ENGINE_TOKEN");
    if (!expected) {
      if (!warnedNoAuth) {
        warnedNoAuth = true;
        console.warn("[engine] ENGINE_TOKEN unset — API auth disabled (local dev only)");
      }
      return true;
    }
    return req.headers["x-engine-token"] === expected;
  }

  function runStatus(runId: string): "running" | "done" | "failed" {
    const seen = jobs.get(runId);
    if (seen && seen.status !== "running") return seen.status;
    const dir = join(root, runId);
    if (existsSync(join(dir, "findings.json"))) return "done";
    if (seen || existsSync(dir)) return "running";
    return "failed";
  }

  return (req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", "http://x");
        if (req.method === "GET" && url.pathname === "/health") {
          send(res, 200, { ok: true, time: new Date().toISOString() });
          return;
        }
        if (!authorized(req)) {
          send(res, 401, { error: "bad or missing x-engine-token" });
          return;
        }

        if (req.method === "POST" && url.pathname === "/runs") {
          let body: { targetUrl?: string; goal?: string; verify?: boolean; baselineRunId?: string };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          const { targetUrl, goal, verify: verifyMode, baselineRunId } = body;
          if (!targetUrl) {
            send(res, 400, { error: "targetUrl required" });
            return;
          }
          try {
            new URL(targetUrl);
          } catch {
            send(res, 400, { error: "targetUrl must be a valid URL" });
            return;
          }
          if (verifyMode && !baselineRunId) {
            send(res, 400, { error: "verify needs baselineRunId" });
            return;
          }
          if (verifyMode && baselineRunId && !existsSync(join(root, baselineRunId, "findings.json"))) {
            send(res, 404, { error: "unknown baselineRunId" });
            return;
          }
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const runId = verifyMode ? `${stamp}-verify` : stamp;
          jobs.set(runId, { status: "running" });
          executeRun({
            targetUrl,
            goal: goal?.trim() || GOAL,
            verifyMode: verifyMode === true,
            baselineRunId,
            outDir: join(root, runId),
            reportsRoot: root,
          }).then(
            () => jobs.set(runId, { status: "done" }),
            (e: Error) => jobs.set(runId, { status: "failed", error: e.message }),
          );
          send(res, 201, { runId, status: "running" });
          return;
        }

        const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
        if (req.method === "GET" && runMatch) {
          const runId = decodeURIComponent(runMatch[1]);
          const status = runStatus(runId);
          if (status === "failed" && !jobs.has(runId) && !existsSync(join(root, runId))) {
            send(res, 404, { error: "unknown run" });
            return;
          }
          const out: Record<string, unknown> = { runId, status };
          if (status === "done") {
            out.findings = JSON.parse(readFileSync(join(root, runId, "findings.json"), "utf8"));
            const vpath = join(root, runId, "verification.json");
            if (existsSync(vpath)) out.verification = JSON.parse(readFileSync(vpath, "utf8"));
            const rpath = join(root, runId, "report.md");
            if (existsSync(rpath)) out.report = readFileSync(rpath, "utf8");
          }
          if (status === "failed") out.error = jobs.get(runId)?.error ?? "run failed";
          send(res, 200, out);
          return;
        }

        const artMatch = url.pathname.match(/^\/runs\/([^/]+)\/artifacts\/(.+)$/);
        if (req.method === "GET" && artMatch) {
          const runId = decodeURIComponent(artMatch[1]);
          const rel = artMatch[2].split("/").map(decodeURIComponent);
          const base = join(root, runId) + sep;
          const full = normalize(join(root, runId, ...rel));
          if (!full.startsWith(base) || !existsSync(full) || !statSync(full).isFile()) {
            send(res, 404, { error: "not found" });
            return;
          }
          send(res, 200, readFileSync(full), mimeOf(full));
          return;
        }

        send(res, 404, { error: "not found" });
      } catch (e) {
        send(res, 500, { error: (e as Error).message });
      }
    })();
  };
}
