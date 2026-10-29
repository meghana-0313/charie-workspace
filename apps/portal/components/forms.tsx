"use client";

import { useState } from "react";

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string } & Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, ...data };
}

export function NewTicketForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/tickets", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({ error: "failed" })).then((d) => d.error as string)) ?? "failed");
      return;
    }
    const { id } = (await res.json()) as { id: string };
    location.href = `/tickets/${id}`;
  }
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="subject">Subject</label>
      <input id="subject" name="subject" required placeholder="Checkout button does nothing" />
      <label htmlFor="body">Customer description</label>
      <textarea id="body" name="body" required placeholder="Customer tried 3 times, gave up. Order lost." />
      <label htmlFor="goal">User task to verify (goal)</label>
      <input id="goal" name="goal" required defaultValue="Buy 3 different travel passes and complete checkout without assistance" />
      <label htmlFor="targetUrl">App URL to test</label>
      <input id="targetUrl" name="targetUrl" required defaultValue="http://localhost:3101" />
      <label htmlFor="voice">Voice note (optional, stored for M4 transcription)</label>
      <input id="voice" name="voice" type="file" accept="audio/*" />
      <div className="row" style={{ marginTop: 12 }}>
        <button disabled={busy}>{busy ? "Filing…" : "File ticket + open room"}</button>
        {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
    </form>
  );
}

export function RunButtons({ ticketId, roomId, targetUrl, baselineRunId }: { ticketId: string; roomId: string; targetUrl: string; baselineRunId?: string }) {
  const [busy, setBusy] = useState(false);
  async function start(kind: "investigate" | "verify") {
    setBusy(true);
    const r = await post("/api/runs", { ticketId, roomId, kind, targetUrl, baselineRunId });
    setBusy(false);
    if (!r.ok) {
      alert(`Run failed: ${String(r.error ?? "unknown")}`);
      return;
    }
    location.reload();
  }
  return (
    <div className="row">
      <button disabled={busy} onClick={() => start("investigate")}>{busy ? "Starting…" : "Run investigation"}</button>
      {baselineRunId && (
        <button disabled={busy} className="secondary" onClick={() => start("verify")}>
          Verify fix against {baselineRunId.slice(0, 19)}
        </button>
      )}
      {!baselineRunId && <span className="muted small">Verify unlocks after the first investigation finishes.</span>}
    </div>
  );
}

export function MessageForm({ roomId }: { roomId: string }) {
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "").trim();
    if (!body) return;
    setBusy(true);
    const r = await post(`/api/rooms/${roomId}/messages`, { body });
    setBusy(false);
    if (r.ok) location.reload();
  }
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="msg">Discuss in room</label>
      <textarea id="msg" name="body" placeholder="e.g. BUG-1 looks server-side; approve the checkout fix?" />
      <div className="row" style={{ marginTop: 8 }}>
        <button disabled={busy}>{busy ? "Posting…" : "Post message"}</button>
      </div>
    </form>
  );
}

export function ApproveButton({ roomId, findingId, instruction }: { roomId: string; findingId: string; instruction: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  async function approve() {
    setState("busy");
    const r = await post("/api/approvals", { roomId, findingIds: [findingId], instruction });
    setState(r.ok ? "done" : "idle");
    if (r.ok) location.reload();
    else alert(`Approval failed: ${String(r.error ?? "unknown")}`);
  }
  return (
    <button className="secondary" disabled={state !== "idle"} onClick={approve}>
      {state === "done" ? "Approved" : state === "busy" ? "Approving…" : "Approve fix instruction"}
    </button>
  );
}
