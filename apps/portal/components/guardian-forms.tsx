"use client";

import { useState } from "react";

async function post(path: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data, status: res.status };
}

export function SeedButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true);
    const r = await post("/api/guardian/simulate");
    setBusy(false);
    setMsg(r.ok ? `Seeded ${String(r.data.saved)} attack events. Now press Analyze.` : "Seeding failed.");
    if (r.ok) setTimeout(() => location.reload(), 600);
  }
  return (
    <span className="row">
      <button onClick={run} disabled={busy}>{busy ? "Seeding…" : "Simulate attack"}</button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}

export function AnalyzeButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true);
    setMsg("Detecting and investigating…");
    const r = await post("/api/guardian/analyze");
    setBusy(false);
    const inc = r.data.incident as { id?: string } | null;
    if (r.ok && inc?.id) {
      location.href = `/guardian/${inc.id}`;
      return;
    }
    setMsg(r.data.mode === "clear" ? "Window is clear - no threats found." : "Analysis failed - is the engine running?");
  }
  return (
    <span className="row">
      <button onClick={run} disabled={busy}>{busy ? "Analyzing…" : "Analyze now"}</button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}

export function RespondForm({ incidentId, defaultTarget }: { incidentId: string; defaultTarget: string }) {
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState("block_ip");
  const [target, setTarget] = useState(defaultTarget);
  async function run() {
    if (!target.trim()) return;
    setBusy(true);
    const r = await post("/api/guardian/respond", { incidentId, action, target: target.trim() });
    setBusy(false);
    if (r.ok) location.reload();
  }
  return (
    <span className="row">
      <select value={action} onChange={(e) => setAction(e.target.value)}>
        <option value="block_ip">Simulate IP block</option>
        <option value="revoke_sessions">Simulate session revocation</option>
        <option value="rate_limit">Simulate rate limit</option>
      </select>
      <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="target" style={{ maxWidth: 220 }} />
      <button onClick={run} disabled={busy || !target.trim()}>{busy ? "Applying…" : "Approve + apply"}</button>
    </span>
  );
}

export function VerifyButton({ incidentId }: { incidentId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true);
    const res = await fetch("/api/guardian/respond", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ incidentId }),
    });
    const data = (await res.json().catch(() => ({}))) as { contained?: boolean; detail?: string };
    setBusy(false);
    setMsg(data.detail ?? "Verify failed.");
    if (data.contained) setTimeout(() => location.reload(), 800);
  }
  return (
    <span className="row">
      <button onClick={run} disabled={busy}>{busy ? "Verifying…" : "Verify containment"}</button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}
