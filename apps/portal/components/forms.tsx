"use client";

import { useEffect, useRef, useState } from "react";
import { VoiceRecorder } from "./suite";

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
  const [recFile, setRecFile] = useState<File | null>(null);
  const [kind, setKind] = useState("bug");
  const [target, setTarget] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    try {
      setTarget(localStorage.getItem("charie-target") ?? "");
    } catch {
      /* private mode */
    }
  }, []);
  const placeholders: Record<string, [string, string]> = {
    bug: ["Checkout button does nothing", "Customer tried 3 times, gave up. Order lost."],
    ux: ["Checkout flow feels confusing", "Users hesitate at the payment step and drop off. Review the journey."],
    a11y: ["Screen reader stuck on the menu", "NVDA reads the nav twice and never reaches the content."],
    security: ["API returns other users data", "Changing the account id in the URL shows someone else's orders."],
  };
  async function submit() {
    const form = formRef.current;
    if (!form || busy) return;
    if (!form.reportValidity()) return;
    setBusy(true);
    setError("");
    const fd = new FormData(form);
    if (recFile) fd.set("voice", recFile);
    try {
      localStorage.setItem("charie-target", target);
    } catch {
      /* private mode */
    }
    const res = await fetch("/api/tickets", { method: "POST", body: fd });
    if (!res.ok) {
      setBusy(false);
      setError(((await res.json().catch(() => ({ error: "failed" }))) as { error?: string }).error ?? "failed");
      return;
    }
    const tkt = (await res.json()) as { id: string };
    location.href = `/tickets/${tkt.id}`;
  }
  const [phSubject, phBody] = placeholders[kind] ?? placeholders.bug;
  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label htmlFor="kind">What is this?</label>
      <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="bug">Customer bug</option>
        <option value="ux">UX review</option>
        <option value="a11y">Accessibility concern</option>
        <option value="security">Security concern</option>
      </select>
      <label htmlFor="targetUrl">App URL to test</label>
      <input id="targetUrl" name="targetUrl" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://your-app.example.com" />
      <label htmlFor="subject">Subject (or record a voice note below instead)</label>
      <input id="subject" name="subject" placeholder={phSubject} />
      <label htmlFor="body">Customer description</label>
      <textarea id="body" name="body" placeholder={phBody} />
      <details>
        <summary className="small muted">Advanced: user task to verify (auto-extracted when blank)</summary>
        <input id="goal" name="goal" placeholder="Buy 3 travel passes and complete checkout without assistance" style={{ marginTop: 6 }} />
      </details>
      <label>Voice note (optional, transcribed into subject + description)</label>
      <VoiceRecorder onFile={setRecFile} />
      {!recFile && (
        <div style={{ marginTop: 8 }}>
          <label htmlFor="voice" style={{ fontWeight: 400 }}>…or attach an audio file</label>
          <input id="voice" name="voice" type="file" accept="audio/*" />
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button disabled={busy}>{busy ? "Filing + investigating…" : "File ticket + investigate"}</button>
        {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
    </form>
  );
}

export function RunButtons({ ticketId, roomId, targetUrl, goal, baselineRunId }: { ticketId: string; roomId: string; targetUrl: string; goal: string; baselineRunId?: string }) {
  const [busy, setBusy] = useState(false);
  async function start(kind: "investigate" | "verify") {
    setBusy(true);
    const r = await post("/api/runs", { ticketId, roomId, kind, targetUrl, goal, baselineRunId });
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
