// Charie Meet: native video rooms. Mesh WebRTC (camera, mic, screen share)
// with portal hosted signaling (polling, no sockets needed). Peers join from
// any tab or device on this workspace; media stays peer to peer.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeetSignal } from "@/lib/types";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function peerId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function MeetCreateForm() {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || busy) return;
        setBusy(true);
        setError("");
        try {
          const res = await fetch("/api/meet/rooms", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: title.trim() }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error ?? "create failed");
          router.push(`/guardian/zoom/rooms/${j.id}`);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Room title, e.g. Incident war room"
          aria-label="Room title"
          style={{ flex: 1, minWidth: 200 }}
        />
        <button type="submit" disabled={busy}>{busy ? "Creating…" : "Start a room"}</button>
      </div>
      {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
    </form>
  );
}

interface Peer {
  id: string;
  name: string;
  role: string;
  stream: MediaStream | null;
}

export function MeetRoom({ roomId, roomTitle, token = "", initialName = "", transcribeOk = true }: { roomId: string; roomTitle: string; token?: string; initialName?: string; transcribeOk?: boolean }) {
  const [name, setName] = useState(initialName);
  const qp = token ? `?token=${encodeURIComponent(token)}` : "";
  const sq = (since: number) => (token ? `?token=${encodeURIComponent(token)}&since=${since}` : `?since=${since}`);
  const [joined, setJoined] = useState(false);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const localVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  const since = useRef(0);
  const me = useRef(peerId());
  const nameRef = useRef("");
  const stopPoll = useRef(false);

  const send = async (to: string, kind: MeetSignal["kind"], payload = "") => {
    await fetch(`/api/meet/rooms/${roomId}/signal${qp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: me.current, to, kind, payload }),
    }).catch(() => {});
  };

  const closePeer = (id: string) => {
    pcs.current[id]?.close();
    delete pcs.current[id];
    setPeers((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  };

  const ensurePeer = (id: string, peerName: string, peerRole = "member"): RTCPeerConnection => {
    const existing = pcs.current[id];
    if (existing) return existing;
    const pc = new RTCPeerConnection(ICE);
    pcs.current[id] = pc;
    setPeers((p) => (p[id] ? p : { ...p, [id]: { id, name: peerName, role: peerRole, stream: null } }));
    for (const track of streamRef.current?.getTracks() ?? []) pc.addTrack(track, streamRef.current!);
    pc.onicecandidate = (e) => {
      if (e.candidate) send(id, "candidate", JSON.stringify(e.candidate.toJSON()));
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      setPeers((p) => ({ ...p, [id]: { id, name: p[id]?.name ?? peerName, role: p[id]?.role ?? 'member', stream } }));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") closePeer(id);
    };
    return pc;
  };

  const handle = async (s: MeetSignal) => {
    if (s.from === me.current) return;
    if (s.to !== "*" && s.to !== me.current) return;
    try {
      if (s.kind === "join") {
        const { name: peerName, role: peerRole } = JSON.parse(s.payload || "{}") as { name?: string; role?: string };
        const pc = ensurePeer(s.from, peerName || "Guest", peerRole === "guest" ? "guest" : "member");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await send(s.from, "offer", JSON.stringify(offer));
      } else if (s.kind === "offer" && s.to === me.current) {
        const pc = ensurePeer(s.from, peers[s.from]?.name ?? "Guest");
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.payload)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await send(s.from, "answer", JSON.stringify(answer));
      } else if (s.kind === "answer" && s.to === me.current) {
        await pcs.current[s.from]?.setRemoteDescription(new RTCSessionDescription(JSON.parse(s.payload)));
      } else if (s.kind === "candidate" && s.to === me.current) {
        await pcs.current[s.from]?.addIceCandidate(new RTCIceCandidate(JSON.parse(s.payload)));
      } else if (s.kind === "leave") {
        closePeer(s.from);
      }
    } catch {
      /* ignore malformed signals */
    }
  };

  useEffect(() => {
    if (!joined) return;
    stopPoll.current = false;
    let timer: ReturnType<typeof setInterval>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/meet/rooms/${roomId}/signal${sq(since.current)}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { signals: MeetSignal[] };
        for (const s of j.signals) {
          since.current = Math.max(since.current, s.seq);
          await handle(s);
        }
      } catch {
        /* retry next tick */
      }
    };
    void poll();
    timer = setInterval(poll, 1500);
    const bye = () => { stopPoll.current = true; void send("*", "leave"); };
    window.addEventListener("beforeunload", bye);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", bye);
      void send("*", "leave");
      for (const id of Object.keys(pcs.current)) pcs.current[id].close();
      pcs.current = {};
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, roomId]);

  useEffect(() => {
    if (localVideo.current && streamRef.current) localVideo.current.srcObject = streamRef.current;
  }, [joined]);

  const join = async () => {
    if (!name.trim()) {
      setError("Enter your name first.");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      nameRef.current = name.trim();
      setJoined(true);
      await send("*", "join", JSON.stringify({ name: nameRef.current, role: token ? "guest" : "member" }));
    } catch {
      setError("Camera or mic blocked. Allow access in the browser, then retry.");
    }
  };

  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  };

  const toggleCam = () => {
    const next = !camOff;
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setCamOff(next);
  };

  const shareScreen = async () => {
    if (sharing) return;
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      for (const pc of Object.values(pcs.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
      }
      if (localVideo.current) {
        localVideo.current.srcObject = screen;
      }
      setSharing(true);
      track.onended = async () => {
        const cam = streamRef.current?.getVideoTracks()[0] ?? null;
        for (const pc of Object.values(pcs.current)) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(cam);
        }
        if (localVideo.current && streamRef.current) localVideo.current.srcObject = streamRef.current;
        setSharing(false);
      };
    } catch {
      /* user cancelled */
    }
  };

  if (!joined) {
    return (
      <div className="card">
        <div className="card-title">Join “{roomTitle}”</div>
        <p className="muted small">Native Charie room. Camera and mic stay between peers; the portal only exchanges connection setup.</p>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" style={{ flex: 1, minWidth: 160 }} />
          <button onClick={join}>Join with camera</button>
        </div>
        {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    );
  }

  const tiles = Object.values(peers);
  return (
    <>
      <div className="meet-grid">
        <div className="meet-tile">
          <video ref={localVideo} autoPlay playsInline muted />
          <span className="meet-name">{nameRef.current} (you, {token ? "customer" : "teammate"}){muted ? " · muted" : ""}{sharing ? " · sharing screen" : ""}</span>
        </div>
        {tiles.map((p) => (
          <PeerTile key={p.id} peer={p} />
        ))}
      </div>
      <div className="meet-controls">
        <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
        <button onClick={toggleCam}>{camOff ? "Camera on" : "Camera off"}</button>
        <button onClick={shareScreen} disabled={sharing}>{sharing ? "Sharing…" : "Share screen"}</button>
      </div>
      <p className="muted small">{tiles.length === 0 ? "Alone here. Share this page URL to invite the team." : `${tiles.length} peer(s) connected.`}</p>
      <LiveNotes roomId={roomId} token={token} canManage={!token} transcribe={transcribeOk} localName={nameRef.current || name} />
    </>
  );
}

function PeerTile({ peer }: { peer: Peer }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && peer.stream) ref.current.srcObject = peer.stream;
  }, [peer.stream]);
  return (
    <div className="meet-tile">
      {peer.stream ? <video ref={ref} autoPlay playsInline /> : <div className="meet-wait">Connecting…</div>}
      <span className="meet-name">{peer.name} {peer.role === "guest" ? "(customer)" : "(teammate)"}</span>
    </div>
  );
}

export function InviteButton({ roomId }: { roomId: string }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  if (link) {
    return (
      <span className="row">
        <code className="small">{link.slice(0, 60)}…</code>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? "Copied" : "Copy invite"}
        </button>
      </span>
    );
  }
  return (
    <button
      className="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/meet/rooms/${roomId}/invite`, { method: "POST" });
        const j = (await res.json().catch(() => ({}))) as { url?: string };
        setBusy(false);
        if (j.url) setLink(j.url);
      }}
    >
      {busy ? "…" : "Invite guest"}
    </button>
  );
}


// Speech recognition (Chrome/Edge). Minimal typing: the DOM lib lacks it.
interface SRResult { 0?: { transcript?: string }; isFinal: boolean }
interface SR extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SRResult> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SR;
    SpeechRecognition?: new () => SR;
  }
}

interface LiveLineView {
  speaker: string;
  role: "teammate" | "customer";
  text: string;
  at: string;
}

/** Charie live notes: opt-in transcription with speaker roles, action notes,
 *  Spark summaries, read-aloud, and save-to-ticket. Transcript lives in call
 *  memory only; nothing is stored unless the team presses Save. */
export function LiveNotes({ roomId, token = "", canManage, transcribe, localName }: { roomId: string; token?: string; canManage: boolean; transcribe: boolean; localName: string }) {
  const qp = token ? `?token=${encodeURIComponent(token)}` : "";
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lines, setLines] = useState<LiveLineView[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [supported] = useState(() => typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  const nameRef = useRef(localName);
  nameRef.current = localName;

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/meet/rooms/${roomId}/live${qp}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { enabled?: boolean; lines?: LiveLineView[]; notes?: string[]; summary?: string };
        if (stop) return;
        setEnabled(j.enabled === true);
        setLines(j.lines ?? []);
        setNotes(j.notes ?? []);
        setSummary(j.summary ?? "");
      } catch {
        /* retry next tick */
      }
    };
    void poll();
    const t = setInterval(poll, 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [roomId, qp]);

  useEffect(() => {
    if (!transcribe || !enabled || !supported) return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    let stopped = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r.isFinal ? r[0]?.transcript?.trim() : "";
        if (text) {
          fetch(`/api/meet/rooms/${roomId}/live${qp}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text, name: nameRef.current }),
          }).catch(() => {});
        }
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      if (!stopped) {
        try {
          rec.start();
        } catch {
          /* mic busy */
        }
      }
    };
    try {
      rec.start();
    } catch {
      /* mic busy */
    }
    return () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [transcribe, enabled, supported, roomId, qp]);

  async function toggle() {
    setBusy("toggle");
    setMsg("");
    const res = await fetch(`/api/meet/rooms/${roomId}/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ liveNotes: !enabled }),
    });
    setBusy("");
    if (res.ok) {
      setEnabled(!enabled);
      if (enabled) {
        setLines([]);
        setNotes([]);
        setSummary("");
      }
    } else {
      setMsg("Toggle failed.");
    }
  }

  async function summarize() {
    setBusy("sum");
    setMsg("");
    try {
      const res = await fetch(`/api/meet/rooms/${roomId}/summarize${qp}`, { method: "POST" });
      const j = (await res.json()) as { summary?: string; model?: string; error?: string };
      if (res.ok && j.summary) {
        setSummary(j.summary);
        setModel(j.model ?? "");
      } else {
        setMsg(j.error ?? "Summary failed.");
      }
    } catch {
      setMsg("Summary failed.");
    }
    setBusy("");
  }

  function readAloud() {
    try {
      const text = summary || notes.join(". ");
      if (!text) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0, 1000)));
    } catch {
      /* speech unavailable */
    }
  }

  async function save() {
    setBusy("save");
    setMsg("");
    try {
      const res = await fetch(`/api/meet/rooms/${roomId}/save`, { method: "POST" });
      const j = (await res.json()) as { savedTo?: string; id?: string; error?: string };
      setMsg(res.ok ? `Saved to ${j.savedTo} (${String(j.id).slice(0, 18)}).` : (j.error ?? "Save failed."));
    } catch {
      setMsg("Save failed.");
    }
    setBusy("");
  }

  if (enabled === null) return <p className="small muted">Checking live notes…</p>;
  if (!enabled) {
    return canManage ? (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Charie live notes</div>
        <p className="small muted">Let Charie join with transcription, speaker roles, action notes, and summaries. Transcript stays in call memory; nothing is stored unless you press Save.</p>
        <button className="secondary" disabled={busy !== ""} onClick={toggle}>{busy === "toggle" ? "…" : "Let Charie join"}</button>
        {msg && <p className="small" style={{ color: "var(--danger)" }}>{msg}</p>}
      </div>
    ) : (
      <p className="small muted">Live notes are off for this call.</p>
    );
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-title">Charie live notes {canManage && <button type="button" className="ghost sm" disabled={busy !== ""} onClick={toggle}>Remove Charie</button>}</div>
      <p className="small muted">
        {transcribe && supported ? "Transcribing your mic · " : transcribe && !supported ? "Transcription needs Chrome or Edge · " : "Your mic is not transcribed · "}
        teammate vs customer labels come from sign-in vs invite.
      </p>
      <div className="live-lines">
        {lines.length === 0 ? (
          <p className="small muted">Listening… speak and lines appear here.</p>
        ) : (
          lines.slice(-30).map((l, i) => (
            <p key={i} className="small"><strong>{l.speaker}</strong> <span className="pill">{l.role}</span> {l.text}</p>
          ))
        )}
      </div>
      {notes.length > 0 && (
        <div>
          <div className="section-label">Action notes</div>
          <ul className="small" style={{ marginTop: 0 }}>
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      {summary && (
        <div>
          <div className="section-label">Summary {model && <span className="muted">· {model}</span>}</div>
          <p className="small" style={{ whiteSpace: "pre-wrap" }}>{summary}</p>
        </div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="secondary sm" disabled={busy !== "" || lines.length === 0} onClick={summarize}>{busy === "sum" ? "Summarizing…" : "Summarize with Charie"}</button>
        <button type="button" className="secondary sm" disabled={!summary && notes.length === 0} onClick={readAloud}>Read aloud</button>
        {canManage && <button type="button" className="secondary sm" disabled={busy !== "" || lines.length === 0} onClick={save}>{busy === "save" ? "Saving…" : "Save notes"}</button>}
        {msg && <span className="small muted">{msg}</span>}
      </div>
    </div>
  );
}

