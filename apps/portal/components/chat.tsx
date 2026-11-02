// Chat with Charie: messenger layout with action receipts, model details,
// attachments (screenshots, videos, files), and voice messages that Charie
// transcribes before answering.

"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatAttachment } from "@/lib/types";

export interface ChatConsent {
  id: string;
  tool: string;
  title: string;
  detail: string;
  status: "pending" | "approved" | "denied" | "done" | "failed";
  result?: string;
}

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  model?: string;
  actions?: string[];
  attachments?: ChatAttachment[];
  consent?: ChatConsent;
  at: string;
}

/** Linkify /tickets/x and /repos/y paths plus bare URLs. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\/tickets\/[a-zA-Z0-9_]+|\/repos\/[a-zA-Z0-9_]+|https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\/(tickets|repos)\//.test(p) ? (
          <a key={i} href={p}>{p}</a>
        ) : /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function modelLabel(model?: string): string {
  if (!model) return "";
  if (model === "heuristic") return "heuristic";
  const m = model.match(/muse-[a-z]+-[0-9.]+/);
  return m ? m[0] : model.slice(0, 24);
}

function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Attachments({ items }: { items: ChatAttachment[] }) {
  if (items.length === 0) return null;
  return (
    <div className="chat-attach">
      {items.map((a) => (
        a.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={a.url} href={a.url} target="_blank" rel="noreferrer"><img className="chip-img" src={a.url} alt={a.name} /></a>
        ) : a.kind === "video" ? (
          <video key={a.url} className="chip-vid" src={a.url} controls preload="metadata" />
        ) : a.kind === "audio" ? (
          <audio key={a.url} src={a.url} controls preload="metadata" />
        ) : (
          <a key={a.url} className="chip-file" href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
        )
      ))}
    </div>
  );
}

export function ChatPanel({ threadId, initial }: { threadId: string | null; initial: ChatMsg[] }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tid, setTid] = useState<string | null>(threadId);
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, busy]);

  async function upload(file: File) {
    setUploading((n) => n + 1);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
      const j = (await res.json()) as ChatAttachment & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "upload failed");
      setPending((p) => [...p, j]);
    } catch (e) {
      setError((e as Error).message);
    }
    setUploading((n) => n - 1);
  }

  async function toggleRecord() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStream.current = stream;
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        void upload(new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type }));
      };
      recorder.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Mic blocked. Allow microphone access to send a voice message.");
    }
  }

  async function send(text: string) {
    const clean = text.trim();
    if ((!clean && pending.length === 0) || busy || uploading > 0) return;
    const atts = pending;
    setBusy(true);
    setInput("");
    setPending([]);
    const at = new Date().toISOString();
    setMsgs((m) => [...m, { role: "user", text: clean, attachments: atts.length > 0 ? atts : undefined, at }]);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const res = await fetch("/api/chat/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: tid, text: clean, attachments: atts }),
        signal: ctl.signal,
      });
      const j = (await res.json()) as { threadId?: string; text?: string; model?: string; actions?: string[]; consent?: ChatConsent; error?: string };
      if (!res.ok) {
        setMsgs((m) => [...m, { role: "assistant", text: `Chat failed: ${j.error ?? res.status}`, at: new Date().toISOString() }]);
      } else {
        if (j.threadId && j.threadId !== tid) {
          setTid(j.threadId);
          window.history.replaceState(null, "", `/chat?thread=${j.threadId}`);
        }
        setMsgs((m) => [...m, { role: "assistant", text: j.text ?? "", model: j.model, actions: j.actions ?? [], consent: j.consent, at: new Date().toISOString() }]);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        setMsgs((m) => [...m, { role: "assistant", text: "Stopped. The request may still finish in the background.", at: new Date().toISOString() }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", text: "Chat failed: network error.", at: new Date().toISOString() }]);
      }
    }
    abort.current = null;
    setBusy(false);
  }

  async function decideConsent(consentId: string, decision: "approved" | "denied") {
    if (!tid || busy) return;
    setBusy(true);
    const res = await fetch("/api/chat/consent", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: tid, consentId, decision }),
    }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) as { status?: ChatConsent["status"]; text?: string; error?: string };
    setMsgs((m) => m.map((x) => (x.consent?.id === consentId ? { ...x, consent: { ...x.consent, status: j.status ?? x.consent.status } } : x)));
    if (res?.ok && j.text) {
      setMsgs((m) => [...m, { role: "assistant", text: j.text ?? "", at: new Date().toISOString() }]);
    } else {
      setError(j.error ?? "That decision did not go through.");
    }
    setBusy(false);
  }

  const suggestions = [
    "What tickets are open?",
    "File a bug for the demo store",
    "Run an accessibility scan",
    "What can you do?",
  ];

  return (
    <div className="chat-shell">
      <div className="chat-scroll">
        {msgs.length === 0 && (
          <div className="chat-empty">
            <div className="big">Talk to Charie</div>
            <p className="muted small" style={{ maxWidth: "52ch", margin: "0 auto 14px" }}>
              Ask for status, file tickets, or run scans. Attach a screenshot, a screen
              recording, or hold the mic and just talk: voice notes are transcribed automatically.
            </p>
            <div className="row" style={{ flexWrap: "wrap", justifyContent: "center" }}>
              {suggestions.map((s) => (
                <button key={s} type="button" className="secondary sm" disabled={busy} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`chat-row ${m.role}`}>
            <span className="chat-avatar" aria-hidden>{m.role === "assistant" ? "C" : "You"}</span>
            <div className="chat-body">
              <div className="chat-bubble2">
                {m.text && <Rich text={m.text} />}
                {m.attachments && <Attachments items={m.attachments} />}
                {m.role === "assistant" && ((m.actions?.length ?? 0) > 0 || m.model) && (
                  <div className="chat-meta">
                    {(m.actions ?? []).map((a) => (
                      <code key={a} className="small" style={{ marginLeft: 6 }}>{a}</code>
                    ))}
                    {m.model && (
                      <details style={{ marginLeft: 6 }}>
                        <summary className="small muted" style={{ cursor: "pointer" }}>Details</summary>
                        <span className="small muted">Model: {modelLabel(m.model)}</span>
                      </details>
                    )}
                  </div>
                )}
              </div>
              {m.consent && (
                <div className="consent-card">
                  <strong className="small">{m.consent.title}</strong>
                  <p className="small muted" style={{ margin: "4px 0 8px" }}>{m.consent.detail}</p>
                  {m.consent.status === "pending" ? (
                    <div className="row">
                      <button type="button" className="sm" disabled={busy} onClick={() => void decideConsent(m.consent!.id, "approved")}>Approve</button>
                      <button type="button" className="secondary sm" disabled={busy} onClick={() => void decideConsent(m.consent!.id, "denied")}>Deny</button>
                    </div>
                  ) : (
                    <span className="badge">{m.consent.status === "done" ? "Ran after your approval" : m.consent.status}</span>
                  )}
                  <p className="small muted" style={{ margin: "6px 0 0" }}>Charie never runs this silently. Nothing happens until you approve.</p>
                </div>
              )}
              <div className="chat-time">{m.role === "assistant" ? "Charie" : "You"} · {clock(m.at)}</div>
            </div>
          </div>
        ))}
        {busy && (
          <p className="small muted row">
            Charie is working…
            <button type="button" className="ghost sm" onClick={() => abort.current?.abort()}>Stop</button>
          </p>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="composer">
          {pending.length > 0 && (
            <div className="pending-attach">
              {pending.map((a) => (
                <span key={a.url} className="chip-file">
                  {a.name}
                  <button
                    type="button" className="ghost sm" aria-label={`Remove ${a.name}`}
                    onClick={() => setPending((p) => p.filter((x) => x.url !== a.url))}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Message Charie… (Enter to send, Shift+Enter for a new line)"
            aria-label="Chat message"
            disabled={busy}
            rows={2}
          />
          <div className="composer-bar">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.txt,.log,.md,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                for (const f of Array.from(e.target.files ?? [])) void upload(f);
                e.target.value = "";
              }}
            />
            <button type="button" className="secondary sm" onClick={() => fileInput.current?.click()} disabled={busy}>
              Attach
            </button>
            <button
              type="button"
              className={recording ? "sm recording" : "secondary sm"}
              onClick={() => void toggleRecord()}
              disabled={busy}
              aria-pressed={recording}
            >
              {recording ? "Stop recording" : "Voice"}
            </button>
            {uploading > 0 && <span className="small muted">Uploading…</span>}
            <span className="spacer" />
            <button disabled={busy || uploading > 0 || (!input.trim() && pending.length === 0)}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
        {error && <p className="small" style={{ color: "var(--danger)", marginTop: 6 }}>{error}</p>}
      </form>
    </div>
  );
}
