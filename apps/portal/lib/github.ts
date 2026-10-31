// GitHub REST integration: repo metadata, trees, tarballs, commit statuses.
// Public repos need no token; private repos use the connection PAT.

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const t = input.trim().replace(/\/$/, "");
  const m1 = t.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (m1) return { owner: m1[1], repo: m1[2] };
  const m2 = t.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (m2 && !t.includes("://")) return { owner: m2[1], repo: m2[2] };
  return null;
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "charie-portal",
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export interface GhRepo {
  defaultBranch: string;
  visibility: "public" | "private";
}

export async function getRepo(owner: string, repo: string, token?: string): Promise<GhRepo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: headers(token),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { default_branch?: string; private?: boolean; visibility?: string };
    return {
      defaultBranch: j.default_branch ?? "main",
      visibility: j.private === true || j.visibility === "private" ? "private" : "public",
    };
  } catch {
    return null;
  }
}

export async function getBranchSha(owner: string, repo: string, branch: string, token?: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`, {
      headers: headers(token),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { commit?: { sha?: string } };
    return j.commit?.sha ?? null;
  } catch {
    return null;
  }
}

/** Recursive tree paths (capped). Null on failure or truncation. */
export async function getTreePaths(owner: string, repo: string, sha: string, token?: string): Promise<string[] | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, {
      headers: headers(token),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { truncated?: boolean; tree?: Array<{ path?: string; type?: string }> };
    if (j.truncated) return null;
    return (j.tree ?? []).filter((e) => e.type === "blob").map((e) => e.path ?? "").filter(Boolean);
  } catch {
    return null;
  }
}

const MAX_TARBALL = 64 * 1024 * 1024;

/** Download the repo tarball (capped at 64MB). Null on any failure. */
export async function downloadTarball(
  owner: string,
  repo: string,
  ref: string,
  token?: string,
): Promise<Buffer | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`, {
      headers: { ...headers(token), accept: "application/vnd.github+json" },
      redirect: "follow",
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok || !res.body) return null;
    const chunks: Buffer[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_TARBALL) {
        reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

/** Native commit status (shows in the PR UI). Needs a token with commit-status scope. */
export async function postCommitStatus(opts: {
  owner: string;
  repo: string;
  sha: string;
  state: "pending" | "success" | "failure" | "error";
  targetUrl?: string;
  description: string;
  token: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${opts.owner}/${opts.repo}/statuses/${opts.sha}`, {
      method: "POST",
      headers: headers(opts.token),
      body: JSON.stringify({
        state: opts.state,
        ...(opts.targetUrl ? { target_url: opts.targetUrl } : {}),
        description: opts.description.slice(0, 140),
        context: "Charie",
      }),
      signal: AbortSignal.timeout(20000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Create a push webhook (needs a token with repo-hook scope). False on any failure. */
export async function createWebhook(opts: {
  owner: string; repo: string; url: string; secret: string; token: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${opts.owner}/${opts.repo}/hooks`, {
      method: "POST",
      headers: headers(opts.token),
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push"],
        config: { url: opts.url, content_type: "json", secret: opts.secret, insecure_ssl: "0" },
      }),
      signal: AbortSignal.timeout(20000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getViewer(token: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: headers(token),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { login?: string }).login ?? null;
  } catch {
    return null;
  }
}

export interface GhMine {
  owner: string;
  repo: string;
  visibility: "public" | "private";
  defaultBranch: string;
  pushedAt: string;
}

/** Repos the token can see (owner + collaborator + org member, newest push first). */
export async function listMyRepos(token: string): Promise<GhMine[] | null> {
  try {
    const res = await fetch("https://api.github.com/user/repos?per_page=50&sort=pushed&affiliation=owner,collaborator,organization_member", {
      headers: headers(token),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Array<{ full_name?: string; private?: boolean; default_branch?: string; pushed_at?: string }>;
    return j
      .map((r) => {
        const [owner, repo] = String(r.full_name ?? "/").split("/");
        return {
          owner, repo,
          visibility: (r.private ? "private" : "public") as "public" | "private",
          defaultBranch: r.default_branch ?? "main",
          pushedAt: r.pushed_at ?? "",
        };
      })
      .filter((r) => r.owner && r.repo);
  } catch {
    return null;
  }
}

/** Exchange an OAuth authorize code for a user token. */
export async function exchangeOAuthCode(opts: {
  clientId: string; clientSecret: string; code: string; redirectUri: string;
}): Promise<string | null> {
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "charie-portal" },
      body: JSON.stringify({
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        code: opts.code,
        redirect_uri: opts.redirectUri,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { access_token?: string }).access_token ?? null;
  } catch {
    return null;
  }
}
