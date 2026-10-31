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
