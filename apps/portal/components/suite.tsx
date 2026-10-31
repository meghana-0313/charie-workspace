// Client components for the Guardian suite + ticket room upgrades.
// Every button POSTs to a portal API route and reloads on success.

"use client";

import { useRef, useState } from "react";

async function post(path: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data, status: res.status };
}

/** In-browser voice recording. Hands a File up; the parent appends it to the ticket form. */
export function VoiceRecorder({ onFile }: { onFile: (f: File | null) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [url, setUrl] = useState("");
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = typeof window !== "undefined" && "MediaRecorder" in window && "mediaDevices" in navigator;

  async function start() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
        onFile(file);
        setUrl(URL.createObjectURL(blob));
      };
      mr.start();
      setRec(mr);
      setSecs(0);
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch {
      setErr("Microphone blocked. Allow access or attach an audio file instead.");
    }
  }

  function stop() {
    rec?.stop();
    setRec(null);
    if (timer.current) clearInterval(timer.current);
  }

  function clear() {
    onFile(null);
    setUrl("");
    setSecs(0);
  }

  if (!supported) return <p className="small muted">This browser cannot record audio. Attach a file below instead.</p>;
  return (
    <span className="row">
      {!rec && url === "" && <button type="button" className="secondary" onClick={start}>Record voice note</button>}
      {rec && (
        <>
          <button type="button" onClick={stop}>Stop ({secs}s)</button>
          <span className="small muted">Recording… describe the bug out loud.</span>
        </>
      )}
      {!rec && url !== "" && (
        <>
          <audio controls src={url} style={{ maxWidth: 260 }} />
          <span className="small muted">{secs}s recorded, will attach.</span>
          <button type="button" className="secondary" onClick={clear}>Discard</button>
        </>
      )}
      {err && <span className="small" style={{ color: "var(--danger)" }}>{err}</span>}
    </span>
  );
}

/** Mark an approval dispatched and reveal the agent handoff prompt. */
export function DispatchButton({ approvalId, roomId }: { approvalId: string; roomId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [prompt, setPrompt] = useState("");
  const [packets, setPackets] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  async function run() {
    setState("busy");
    const r = await post(`/api/approvals/${approvalId}/dispatch`, { roomId });
    if (r.ok) {
      setState("done");
      setPrompt(String((r.data as { prompt?: string }).prompt ?? ""));
      setPackets(Array.isArray((r.data as { packets?: string[] }).packets) ? (r.data as { packets: string[] }).packets : []);
    } else {
      setState("idle");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  if (state === "done") {
    return (
      <span className="small">
        <span className="pill">sent-to-agent</span>{" "}
        <button className="secondary sm" onClick={copy}>{copied ? "Copied" : "Copy agent prompt"}</button>
        {packets.map((u) => (
          <span key={u}> <a href={u} target="_blank" rel="noreferrer">packet</a></span>
        ))}
      </span>
    );
  }
  return (
    <button className="secondary" disabled={state !== "idle"} onClick={run}>
      {state === "busy" ? "Dispatching…" : "Dispatch to coding agent"}
    </button>
  );
}

export function WorkOrderButtons({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  async function run(path: string, label: string) {
    setBusy(label);
    setMsg("");
    const r = await post(path);
    setBusy("");
    if (r.ok) location.reload();
    else setMsg(String((r.data.error as string) ?? "failed"));
  }
  return (
    <span className="row">
      {status === "proposed" && (
        <button disabled={busy !== ""} onClick={() => run(`/api/guardian/workorders/${id}/approve`, "approve")}>
          {busy === "approve" ? "Approving…" : "Approve order"}
        </button>
      )}
      {status === "approved" && (
        <button disabled={busy !== ""} onClick={() => run(`/api/guardian/workorders/${id}/schedule`, "schedule")}>
          {busy === "schedule" ? "Scheduling…" : "Schedule for tonight"}
        </button>
      )}
      {(status === "approved" || status === "scheduled") && (
        <button disabled={busy !== ""} className="secondary" onClick={() => run("/api/guardian/nightshift", "run")}>
          {busy === "run" ? "Night shift running…" : "Run now (demo the shift)"}
        </button>
      )}
      {msg && <span className="small" style={{ color: "var(--danger)" }}>{msg}</span>}
    </span>
  );
}

/** One-click proposal with a prebuilt plan (from an incident, cluster, or check). */
export function ProposeWorkOrderButton({ title, source, sourceRef, plan }: {
  title: string; source: string; sourceRef: string;
  plan: Array<{ kind: string; label: string; ref: string; targetUrl?: string; baselineRunId?: string; goal?: string }>;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  async function run() {
    setState("busy");
    const r = await post("/api/guardian/workorders", { title, source, sourceRef, plan });
    if (r.ok) {
      setState("done");
      location.href = `/guardian/work/${String((r.data as { id?: string }).id ?? "")}`;
    } else setState("idle");
  }
  return (
    <button className="secondary" disabled={state !== "idle"} onClick={run}>
      {state === "busy" ? "Proposing…" : "Propose work order"}
    </button>
  );
}

export function SignalsIngestForm() {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  async function run() {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBusy(true);
    const r = await post("/api/guardian/signals", {
      messages: lines.map((line) => {
        const m = line.match(/^\[(support|chat|call|review)\]\s*(.*)$/i);
        return m ? { channel: m[1].toLowerCase(), text: m[2] } : { text: line };
      }),
    });
    setBusy(false);
    if (r.ok) location.reload();
  }
  return (
    <div>
      <label htmlFor="sigtext">Paste customer messages (one per line, optional [channel] prefix)</label>
      <textarea
        id="sigtext"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"[support] Checkout charged me twice, furious\n[chat] pay button spins forever"}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button disabled={busy || !text.trim()} onClick={run}>{busy ? "Grading + clustering…" : "Ingest + cluster"}</button>
      </div>
    </div>
  );
}

export function SeedSignalsButton() {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const r = await post("/api/guardian/signals/seed");
    setBusy(false);
    if (r.ok) location.reload();
  }
  return (
    <button className="secondary" disabled={busy} onClick={run}>{busy ? "Seeding…" : "Load demo inbox"}</button>
  );
}

export function NightShiftButton({ orderIds }: { orderIds?: string[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true);
    setMsg("Shift running. Browser re-verifications take minutes; leave this open.");
    const r = await post("/api/guardian/nightshift", orderIds ? { orderIds } : undefined);
    setBusy(false);
    if (r.ok) location.reload();
    else setMsg(String((r.data.error as string) ?? "shift failed"));
  }
  return (
    <span className="row">
      <button disabled={busy} onClick={run}>{busy ? "Shift running…" : "Run night shift now"}</button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}

export function PentestButton() {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const r = await post("/api/guardian/pentest");
    setBusy(false);
    if (r.ok) location.reload();
  }
  return (
    <button disabled={busy} onClick={run}>{busy ? "Scanning…" : "Run pen-test suite"}</button>
  );
}

export function SweepButton() {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const r = await post("/api/guardian/sweep");
    setBusy(false);
    if (r.ok) location.reload();
  }
  return (
    <button className="secondary" disabled={busy} onClick={run}>{busy ? "Sweeping…" : "Sweep now"}</button>
  );
}

export function ZoomJoinForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    if (!url.trim()) return;
    setBusy(true);
    const r = await post("/api/guardian/zoom/join", { meetingUrl: url.trim() });
    setBusy(false);
    setMsg(r.ok ? `Bot dispatched: ${String((r.data as { id?: string }).id ?? "")}` : String((r.data.error as string) ?? "failed"));
  }
  return (
    <span className="row">
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://zoom.us/j/…" style={{ maxWidth: 300 }} />
      <button disabled={busy || !url.trim()} onClick={run}>{busy ? "Dispatching…" : "Send bot"}</button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}

/** Phone + desktop push alerts via Web Push. Needs NEXT_PUBLIC_VAPID_PUBLIC. */
export function PushButton() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "unsupported">("idle");
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC ?? "";
  async function run() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !key) {
      setState("unsupported");
      return;
    }
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
      });
      const r = await post("/api/push/subscribe", sub.toJSON());
      setState(r.ok ? "done" : "idle");
    } catch {
      setState("idle");
    }
  }
  if (state === "done") return <span className="pill">push alerts on</span>;
  if (state === "unsupported") return <span className="small muted">Push unavailable on this browser or VAPID key missing.</span>;
  return (
    <button className="secondary" disabled={state === "busy"} onClick={run}>
      {state === "busy" ? "Enabling…" : "Enable push alerts"}
    </button>
  );
}

/** Voice-based incident reporting: record or attach, transcribe, pin to the incident. */
export function IncidentVoiceForm({ incidentId }: { incidentId: string }) {
  const [recFile, setRecFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (recFile) fd.set("voice", recFile);
    const f = fd.get("voice");
    if (!(f instanceof File) || f.size === 0) {
      setMsg("Record or attach audio first.");
      return;
    }
    setBusy(true);
    setMsg("Transcribing…");
    const res = await fetch(`/api/guardian/incidents/${incidentId}/voice`, { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) location.reload();
    else setMsg("Transcription failed. Is the engine keyed?");
  }
  return (
    <form onSubmit={submit}>
      <VoiceRecorder onFile={setRecFile} />
      {!recFile && <input name="voice" type="file" accept="audio/*" style={{ marginTop: 8 }} />}
      <div className="row" style={{ marginTop: 8 }}>
        <button disabled={busy}>{busy ? "Transcribing…" : "Attach voice brief"}</button>
        {msg && <span className="small muted">{msg}</span>}
      </div>
    </form>
  );
}

/** Roll back a simulated response action (audit-kept, status flips). */
export function RollbackButton({ incidentId, actionId }: { incidentId: string; actionId: string }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const res = await fetch("/api/guardian/respond", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ incidentId, rollbackId: actionId }),
    });
    setBusy(false);
    if (res.ok) location.reload();
  }
  return (
    <button className="secondary" disabled={busy} onClick={run}>
      {busy ? "Rolling back…" : "Roll back simulation"}
    </button>
  );
}

/** Log file ingestion: JSON array or JSONL of security events. */
export function UploadLogsForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f = fd.get("logs");
    if (!(f instanceof File) || f.size === 0) return;
    setBusy(true);
    const res = await fetch("/api/guardian/events/upload", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as { saved?: number; error?: string };
    setBusy(false);
    setMsg(res.ok ? `Ingested ${data.saved} events. Press Analyze now.` : String(data.error ?? "failed"));
    if (res.ok) setTimeout(() => location.reload(), 600);
  }
  return (
    <form onSubmit={submit}>
      <span className="row">
        <input name="logs" type="file" accept=".json,.jsonl,.log,.txt" style={{ maxWidth: 260 }} />
        <button className="secondary" disabled={busy}>{busy ? "Ingesting…" : "Upload log file"}</button>
        {msg && <span className="small muted">{msg}</span>}
      </span>
    </form>
  );
}
