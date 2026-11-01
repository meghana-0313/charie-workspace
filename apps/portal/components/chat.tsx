// Chat with Charie: thread panel with action receipts and model badges.

"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  model?: string;
  actions?: string[];
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

export function ChatPanel({ threadId, initial }: { threadId: string | null; initial: ChatMsg[] }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tid, setTid] = useState<string | null>(threadId);
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setInput("");
    const at = new Date().toISOString();
    setMsgs((m) => [...m, { role: "user", text: clean, at }]);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const res = await fetch("/api/chat/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: tid, text: clean }),
        signal: ctl.signal,
      });
      const j = (await res.json()) as { threadId?: string; text?: string; model?: string; actions?: string[]; error?: string };
      if (!res.ok) {
        setMsgs((m) => [...m, { role: "assistant", text: `Chat failed: ${j.error ?? res.status}`, at: new Date().toISOString() }]);
      } else {
        if (j.threadId && j.threadId !== tid) {
          setTid(j.threadId);
          window.history.replaceState(null, "", `/chat?thread=${j.threadId}`);
        }
        setMsgs((m) => [...m, { role: "assistant", text: j.text ?? "", model: j.model, actions: j.actions ?? [], at: new Date().toISOString() }]);
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

  const suggestions = [
    "What tickets are open?",
    "File a bug for the demo store",
    "Run an accessibility scan",
    "What can you do?",
  ];

  return (
    <div>
      <div className="chat-log">
        {msgs.length === 0 && (
          <div>
            <p className="muted small">Ask Charie to check status, file tickets, or run scans. It acts with tools and shows receipts.</p>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {suggestions.map((s) => (
                <button key={s} type="button" className="secondary sm" disabled={busy} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="chat-bubble">
              <Rich text={m.text} />
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
        <div className="row" style={{ marginTop: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Charie…"
            aria-label="Chat message"
            style={{ flex: 1 }}
            disabled={busy}
          />
          <button disabled={busy || !input.trim()}>{busy ? "Sending…" : "Send"}</button>
        </div>
      </form>
    </div>
  );
}
