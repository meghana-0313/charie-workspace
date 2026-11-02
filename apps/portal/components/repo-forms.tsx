// Client components for connected repos: connect form, build trigger,
// live build polling, disconnect.

"use client";

import { useEffect, useState } from "react";

export function ConnectForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [advanced, setAdvanced] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/repos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: String(fd.get("url") ?? ""),
        token: String(fd.get("token") ?? "") || undefined,
        subdir: String(fd.get("subdir") ?? "") || undefined,
        startCommand: String(fd.get("startCommand") ?? "") || undefined,
        branch: String(fd.get("branch") ?? "") || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    setBusy(false);
    if (res.ok && data.id) location.href = `/repos/${data.id}`;
    else setMsg(data.error ?? "connect failed");
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="repo-url">Repository URL or owner/repo</label>
      <input id="repo-url" name="url" required placeholder="https://github.com/acme/shop" />
      <p className="field-hint">Public repos connect with no credentials at all. Private repos need one of: GitHub connected above, or an access token below.</p>
      <div style={{ marginTop: 8 }}>
        <button type="button" className="ghost sm" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
          {advanced ? "Hide options" : "Private repo token and build options"}
        </button>
      </div>
      {advanced && (
        <>
          <label htmlFor="repo-token">Access token (private repos only, stored server-side)</label>
          <input id="repo-token" name="token" type="password" placeholder="ghp_… (optional when GitHub is connected above)" autoComplete="off" />
          <label htmlFor="repo-branch">Branch (blank = default)</label>
          <input id="repo-branch" name="branch" placeholder="main" />
          <label htmlFor="repo-subdir">Subdirectory (app lives in a subfolder)</label>
          <input id="repo-subdir" name="subdir" placeholder="apps/demo-target" />
          <label htmlFor="repo-start">Start command (generated Dockerfiles only)</label>
          <input id="repo-start" name="startCommand" placeholder="npm start" />
        </>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button disabled={busy}>{busy ? "Connecting…" : "Connect repository"}</button>
        {msg && <span className="small" style={{ color: "var(--danger)" }}>{msg}</span>}
      </div>
    </form>
  );
}

export function BuildButton({ repoId, building }: { repoId: string; building: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true);
    setMsg("Uploading source, starting Cloud Build…");
    const res = await fetch(`/api/repos/${repoId}/build`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (res.ok) location.reload();
    else setMsg(data.error ?? "build failed to start");
  }
  return (
    <span className="row">
      <button disabled={busy || building} onClick={run}>
        {building ? "Build in flight…" : busy ? "Starting…" : "Build + test now"}
      </button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}

const TERMINAL = ["deployed", "failure", "error"];

export function BuildPoller({ buildId, status }: { buildId: string; status: string }) {
  const [live, setLive] = useState(status);
  const [detail, setDetail] = useState("");
  useEffect(() => {
    if (TERMINAL.includes(status)) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const res = await fetch(`/api/builds/${buildId}`);
        const data = (await res.json()) as { status?: string; detail?: string };
        if (stop) return;
        if (data.status) setLive(data.status);
        if (data.detail) setDetail(data.detail);
        if (data.status && TERMINAL.includes(data.status)) {
          setTimeout(() => location.reload(), 1200);
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!stop) timer = setTimeout(tick, 15000);
    }
    timer = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [buildId, status]);
  return (
    <span className="small muted">
      {live}
      {detail ? ` · ${detail}` : ""}
      {!TERMINAL.includes(live) && " · polling…"}
    </span>
  );
}

export function DisconnectButton({ repoId }: { repoId: string }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm("Disconnect this repository? Builds stay in history; the deployed app keeps running.")) return;
    setBusy(true);
    const res = await fetch(`/api/repos/${repoId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) location.href = "/repos";
  }
  return (
    <button className="danger-ghost sm" disabled={busy} onClick={run}>
      {busy ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}

export function GithubConnect() {
  const [status, setStatus] = useState<null | { configured: boolean; connected: boolean; login: string | null }>(null);
  const [repos, setRepos] = useState<null | Array<{ owner: string; repo: string; visibility: string; defaultBranch: string }>>(null);
  const [busy, setBusy] = useState("");
  const [listing, setListing] = useState(false);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch("/api/github/status").then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  }, []);
  async function load() {
    setMsg("");
    setListing(true);
    const res = await fetch("/api/github/repos");
    const j = (await res.json().catch(() => ({}))) as { repos?: typeof repos; error?: string };
    setListing(false);
    if (res.ok && j.repos) setRepos(j.repos);
    else setMsg(j.error ?? "could not list repos");
  }
  async function disconnect() {
    await fetch("/api/github/disconnect", { method: "DELETE" });
    location.reload();
  }
  async function connect(full: string) {
    setBusy(full);
    setMsg("");
    const res = await fetch("/api/repos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: full }),
    });
    const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (res.ok && j.id) {
      location.href = `/repos/${j.id}`;
      return;
    }
    setBusy("");
    setMsg(j.error ?? "connect failed");
  }
  if (!status) return <p className="small muted">Checking GitHub…</p>;
  if (!status.configured) {
    const callback = `${location.origin}/api/github/oauth/callback`;
    return (
      <div>
        <button disabled style={{ width: "100%", justifyContent: "center" }}>Connect GitHub</button>
        <p className="small muted" style={{ marginTop: 10 }}>
          One-click connect switches on after a one-time OAuth App setup by the workspace owner (2 minutes, once ever):
        </p>
        <ol className="repro small">
          <li>GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.</li>
          <li>Homepage URL: <code>{location.origin}</code></li>
          <li>Authorization callback URL: <code>{callback}</code></li>
          <li>Put the Client ID and Secret in the portal secrets as <code>GITHUB_OAUTH_CLIENT_ID</code> and <code>GITHUB_OAUTH_CLIENT_SECRET</code>, then reload.</li>
        </ol>
        <p className="small muted">Until then, paste any public repo URL below. It connects immediately with nothing else needed.</p>
      </div>
    );
  }
  if (!status.connected) {
    return (
      <div>
        <button onClick={() => { location.href = "/api/github/oauth/start"; }} style={{ width: "100%", justifyContent: "center" }}>Connect GitHub</button>
        <p className="small muted" style={{ marginTop: 8 }}>One click on GitHub, pick a repo here, done. No tokens to create, paste, or rotate.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="small">
        Connected as <strong>{status.login ?? "you"}</strong>.{" "}
        <button type="button" className="ghost sm" onClick={disconnect}>Disconnect</button>
      </p>
      {!repos ? (
        <button type="button" className="secondary" onClick={load} disabled={listing}>{listing ? "Listing…" : "List my repos"}</button>
      ) : repos.length === 0 ? (
        <p className="small muted">No repos visible to this connection.</p>
      ) : (
        <>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your repos…" aria-label="Search your repos" style={{ marginBottom: 8 }} />
          <table>
            <thead><tr><th>Repo</th><th>Visibility</th><th></th></tr></thead>
            <tbody>
              {repos.filter((r) => `${r.owner}/${r.repo}`.toLowerCase().includes(query.trim().toLowerCase())).map((r) => {
                const full = `${r.owner}/${r.repo}`;
                return (
                  <tr key={full}>
                    <td className="small">{full}<br /><span className="muted">{r.defaultBranch}</span></td>
                    <td className="small muted">{r.visibility}</td>
                    <td>
                      <button type="button" className="secondary sm" disabled={busy !== ""} onClick={() => connect(full)}>
                        {busy === full ? "Connecting…" : "Connect"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {repos.filter((r) => `${r.owner}/${r.repo}`.toLowerCase().includes(query.trim().toLowerCase())).length === 0 && (
            <p className="small muted">No repos match “{query}”.</p>
          )}
        </>
      )}
      {msg && <p className="small" style={{ color: "var(--danger)" }}>{msg}</p>}
    </div>
  );
}
