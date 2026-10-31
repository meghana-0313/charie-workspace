// Autopilot client components: schedule form, rows, run-due trigger.

"use client";

import { useState } from "react";
import { Badge } from "./ui";

const KIND_LABEL: Record<string, string> = {
  sweep: "Guardian sweep",
  pentest: "Security re-scan",
  nightshift: "Night shift",
  logwatch: "Log watch",
};

export function ScheduleForm() {
  const [kind, setKind] = useState("sweep");
  const [preset, setPreset] = useState("daily");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/autopilot/schedules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, preset }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "schedule failed");
      return;
    }
    location.reload();
  }
  return (
    <form onSubmit={run}>
      <div className="row">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What to run">
          <option value="sweep">Guardian sweep</option>
          <option value="pentest">Security re-scan</option>
          <option value="nightshift">Night shift</option>
          <option value="logwatch">Log watch</option>
        </select>
        <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="How often">
          <option value="hourly">hourly</option>
          <option value="daily">daily</option>
          <option value="weekly">weekly</option>
        </select>
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Add schedule"}</button>
      </div>
      {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
    </form>
  );
}

export interface ScheduleRowProps {
  id: string;
  kind: string;
  preset: string;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: string;
}

export function ScheduleRow(s: ScheduleRowProps) {
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/autopilot/schedules/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    location.reload();
  }
  async function remove() {
    if (!confirm(`Delete this ${KIND_LABEL[s.kind] ?? s.kind} schedule?`)) return;
    setBusy(true);
    await fetch(`/api/autopilot/schedules/${s.id}`, { method: "DELETE" });
    location.reload();
  }
  async function runNow() {
    setBusy(true);
    await fetch(`/api/autopilot/schedules/${s.id}/run`, { method: "POST" });
    location.reload();
  }
  return (
    <tr>
      <td>{KIND_LABEL[s.kind] ?? s.kind}</td>
      <td><Badge>{s.preset}</Badge></td>
      <td className="small muted">
        {s.lastRunAt ? `${s.lastRunAt.slice(0, 16).replace("T", " ")} · ${s.lastStatus ?? ""}` : "never"}
      </td>
      <td>
        <span className="row">
          <button className="secondary sm" disabled={busy || !s.enabled} onClick={runNow}>Run now</button>
          <button className="secondary sm" disabled={busy} onClick={() => patch({ enabled: !s.enabled })}>
            {s.enabled ? "Pause" : "Resume"}
          </button>
          <button className="danger-ghost sm" disabled={busy} onClick={remove}>Delete</button>
        </span>
      </td>
    </tr>
  );
}

export function TickButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/autopilot/tick", { method: "POST" });
      const j = (await res.json()) as { ran?: number; advanced?: number; error?: string };
      setMsg(res.ok ? `Ran ${j.ran ?? 0} due schedule(s), advanced ${j.advanced ?? 0} build(s).` : (j.error ?? "tick failed"));
    } catch {
      setMsg("tick failed");
    }
    setBusy(false);
    setTimeout(() => location.reload(), 1200);
  }
  return (
    <span className="row">
      <button className="secondary" disabled={busy} onClick={run}>{busy ? "Running…" : "Run due now"}</button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}
