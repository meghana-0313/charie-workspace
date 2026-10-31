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
      <label htmlFor="repo-token">Token (private repos only, commit statuses need it)</label>
      <input id="repo-token" name="token" type="password" placeholder="ghp_… (stored server-side)" autoComplete="off" />
      <div style={{ marginTop: 8 }}>
        <button type="button" className="ghost sm" onClick={() => setAdvanced(!advanced)}>
          {advanced ? "Hide build options" : "Build options (subdir, start command)"}
        </button>
      </div>
      {advanced && (
        <>
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
