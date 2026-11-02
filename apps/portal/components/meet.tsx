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
  const [agentOn, setAgentOn] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [startMuted, setStartMuted] = useState(false);
  const [startCamOff, setStartCamOff] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [previewErr, setPreviewErr] = useState("");
  const localVideo = useRef<HTMLVideoElement>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
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

  // Pre-join device preview: see yourself before anyone else does. The same
  // stream is reused on Join so the permission prompt only fires once.
  useEffect(() => {
    if (joined) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: !audioOnly, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (previewVideo.current) previewVideo.current.srcObject = stream;
        setPreviewErr("");
      } catch {
        if (!cancelled) setPreviewErr("Camera or mic unavailable here. You can still try joining below.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [joined, audioOnly]);

  const join = async () => {
    if (!name.trim()) {
      setError("Enter your name first.");
      return;
    }
    setError("");
    try {
      // Reuse the preview stream when it matches the chosen mode; only prompt
      // again when the caller switched between camera and audio only.
      let stream = streamRef.current;
      const hasVideo = (stream?.getVideoTracks().length ?? 0) > 0;
      if (!stream || hasVideo === audioOnly) {
        stream?.getTracks().forEach((t) => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({ video: !audioOnly, audio: true });
        streamRef.current = stream;
      }
      stream.getAudioTracks().forEach((t) => { t.enabled = !startMuted; });
      stream.getVideoTracks().forEach((t) => { t.enabled = !startCamOff; });
      setMuted(startMuted);
      setCamOff(audioOnly || startCamOff);
      nameRef.current = name.trim();
      setJoined(true);
      await send("*", "join", JSON.stringify({ name: nameRef.current, role: token ? "guest" : "member" }));
    } catch {
      setError("Camera or mic blocked. Allow access in the browser, then retry.");
    }
  };

  const leave = () => {
    void send("*", "leave");
    for (const id of Object.keys(pcs.current)) pcs.current[id].close();
    pcs.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPeers({});
    setJoined(false);
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
        <p className="muted small">{token ? "Step 2 of 2: your check-in is done. " : ""}Check how you look and sound, then join. Camera and mic stay between peers; the portal only exchanges connection setup.</p>
        {!audioOnly && <video ref={previewVideo} autoPlay playsInline muted className="meet-preview" aria-label="Camera preview" />}
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" autoFocus style={{ flex: 1, minWidth: 160 }} />
          <button onClick={join}>{audioOnly ? "Join audio only" : "Join call"}</button>
        </div>
        <div className="row small" style={{ marginTop: 8 }}>
          <label className="row" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={startMuted} onChange={(e) => setStartMuted(e.target.checked)} />
            Start muted
          </label>
          <label className="row" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={startCamOff} disabled={audioOnly} onChange={(e) => setStartCamOff(e.target.checked)} />
            Camera off
          </label>
          <label className="row" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={audioOnly} onChange={(e) => setAudioOnly(e.target.checked)} />
            Audio only
          </label>
        </div>
        {previewErr && <p className="small" style={{ color: "var(--danger)" }}>{previewErr}</p>}
        {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    );
  }

  const tiles = Object.values(peers);
  return (
    <div className="war-layout">
      <div className="war-main">
        <div className="meet-grid">
          <div className="meet-tile">
            {audioOnly ? <div className="meet-wait">Audio only</div> : <video ref={localVideo} autoPlay playsInline muted />}
            <span className="meet-name">{nameRef.current} (you, {token ? "customer" : "teammate"}){muted ? " · muted" : ""}{sharing ? " · sharing screen" : ""}</span>
          </div>
          {tiles.map((p) => (
            <PeerTile key={p.id} peer={p} onRemove={() => closePeer(p.id)} />
          ))}
          {agentOn && (
            <div className="meet-tile" style={{ background: "radial-gradient(120% 120% at 50% 0%, #241448 0%, #12081f 70%)", borderColor: "rgba(167,139,250,.5)" }}>
              <div className="orb-wrap" style={{ width: 130, height: 130, marginTop: 18 }}>
                <span className="orb-ring" />
                <span className="orb-core" />
                <span className="orb-eyes"><i /><i /></span>
              </div>
              <span className="meet-name"><span className="wave-bars"><i /><i /><i /><i /><i /></span> CHARIE AI · {agentSpeaking ? "Speaking" : "Listening"}</span>
            </div>
          )}
        </div>
        <div className="meet-controls">
          <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
          <button onClick={toggleCam}>{camOff ? "Camera on" : "Camera off"}</button>
          <button onClick={shareScreen} disabled={sharing}>{sharing ? "Sharing…" : "Share screen"}</button>
          {!token && <InviteButton roomId={roomId} />}
          <button className="danger-ghost" onClick={leave}>Leave call</button>
        </div>
        <p className="muted small">{tiles.length === 0 ? (token ? "You are in. Waiting for the host to join." : "Alone here. Invite a guest with the button above, or send the room link to your team.") : `${tiles.length} peer(s) connected.`}</p>
      </div>
      <aside className="side-panel">
        <LiveNotes
          roomId={roomId}
          token={token}
          canManage={!token}
          transcribe={transcribeOk}
          localName={nameRef.current || name}
          onAgentChange={setAgentOn}
          onAgentSpeak={setAgentSpeaking}
          onRequestShare={() => { void shareScreen().catch(() => {}); }}
        />
      </aside>
    </div>
  );
}

function PeerTile({ peer, onRemove }: { peer: Peer; onRemove: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (ref.current && peer.stream) ref.current.srcObject = peer.stream;
  }, [peer.stream]);
  useEffect(() => {
    if (peer.stream) {
      setStuck(false);
      return;
    }
    const t = setTimeout(() => setStuck(true), 15000);
    return () => clearTimeout(t);
  }, [peer.stream, peer.id]);
  return (
    <div className="meet-tile">
      {peer.stream ? (
        <video ref={ref} autoPlay playsInline />
      ) : stuck ? (
        <div className="meet-wait">
          No media yet. They may have blocked their camera, or the network is slow.
          <button className="secondary" style={{ marginTop: 8 }} onClick={onRemove}>Remove tile</button>
        </div>
      ) : (
        <div className="meet-wait">Connecting…</div>
      )}
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
  role: "teammate" | "customer" | "agent";
  text: string;
  at: string;
}

interface AgentActionView {
  id: string;
  kind: "investigate" | "share-screen" | "workorder" | "summarize";
  title: string;
  detail: string;
  status: "pending" | "approved" | "denied" | "done" | "failed";
  at: string;
  result?: string;
}

interface AgentStateView {
  enabled: boolean;
  thoughts: Array<{ at: string; text: string }>;
  actions: AgentActionView[];
}

/** War-room side panel: Transcript | Charie (thinking + consent cards) |
 *  Notes & Actions. Charie only acts after a human approves a card. */
export function LiveNotes({ roomId, token = "", canManage, transcribe, localName, onAgentChange, onAgentSpeak, onRequestShare }: {
  roomId: string; token?: string; canManage: boolean; transcribe: boolean; localName: string;
  onAgentChange?: (on: boolean) => void; onAgentSpeak?: (speaking: boolean) => void; onRequestShare?: () => void;
}) {
  const qp = token ? `?token=${encodeURIComponent(token)}` : "";
  const [tab, setTab] = useState<"transcript" | "charie" | "notes">("transcript");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lines, setLines] = useState<LiveLineView[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [model, setModel] = useState("");
  const [agent, setAgent] = useState<AgentStateView>({ enabled: false, thoughts: [], actions: [] });
  const [voice, setVoice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [supported] = useState(() => typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  const nameRef = useRef(localName);
  nameRef.current = localName;
  const spokenRef = useRef(0);
  const voiceRef = useRef(false);
  voiceRef.current = voice;
  const onAgentChangeRef = useRef(onAgentChange);
  onAgentChangeRef.current = onAgentChange;
  const onAgentSpeakRef = useRef(onAgentSpeak);
  onAgentSpeakRef.current = onAgentSpeak;

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const [liveRes, agentRes] = await Promise.all([
          fetch(`/api/meet/rooms/${roomId}/live${qp}`, { cache: "no-store" }),
          fetch(`/api/meet/rooms/${roomId}/agent${qp}`, { cache: "no-store" }),
        ]);
        if (stop) return;
        if (liveRes.ok) {
          const j = (await liveRes.json()) as { enabled?: boolean; lines?: LiveLineView[]; notes?: string[]; summary?: string };
          setEnabled(j.enabled === true);
          setLines(j.lines ?? []);
          setNotes(j.notes ?? []);
          setSummary(j.summary ?? "");
        }
        if (agentRes.ok) {
          const a = (await agentRes.json()) as AgentStateView;
          setAgent(a);
          onAgentChangeRef.current?.(a.enabled === true);
        }
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

  // Charie speaks her transcript lines aloud when voice is on.
  useEffect(() => {
    const agentLines = lines.filter((l) => l.role === "agent");
    if (agentLines.length < spokenRef.current) spokenRef.current = agentLines.length;
    if (!voiceRef.current || agentLines.length <= spokenRef.current) return;
    const fresh = agentLines.slice(spokenRef.current);
    spokenRef.current = agentLines.length;
    try {
      for (const l of fresh) {
        const u = new SpeechSynthesisUtterance(l.text.slice(0, 300));
        u.onstart = () => onAgentSpeakRef.current?.(true);
        u.onend = () => onAgentSpeakRef.current?.(false);
        window.speechSynthesis.speak(u);
      }
    } catch {
      /* speech unavailable */
    }
  }, [lines]);

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
        try { rec.start(); } catch { /* mic busy */ }
      }
    };
    try { rec.start(); } catch { /* mic busy */ }
    return () => {
      stopped = true;
      try { rec.stop(); } catch { /* already stopped */ }
    };
  }, [transcribe, enabled, supported, roomId, qp]);

  async function postSettings(on: boolean) {
    await fetch(`/api/meet/rooms/${roomId}/settings`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ liveNotes: on }),
    }).catch(() => {});
  }

  async function agentPost(body: Record<string, unknown>) {
    const res = await fetch(`/api/meet/rooms/${roomId}/agent${qp}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    return res;
  }

  async function toggleAgent() {
    setBusy("agent");
    setMsg("");
    if (agent.enabled) {
      await agentPost({ op: "disable" });
      setAgent((a) => ({ ...a, enabled: false }));
      onAgentChangeRef.current?.(false);
    } else {
      if (!enabled) { await postSettings(true); setEnabled(true); }
      const res = await agentPost({ op: "enable" });
      if (res?.ok) {
        setAgent((a) => ({ ...a, enabled: true }));
        onAgentChangeRef.current?.(true);
        setTab("charie");
      } else setMsg("Charie could not join.");
    }
    setBusy("");
  }

  async function decide(action: AgentActionView, decision: "approved" | "denied") {
    setBusy(action.id);
    const res = await agentPost({ op: "decide", actionId: action.id, decision });
    if (res?.ok) {
      const out = (await res.json()) as AgentActionView;
      setAgent((a) => ({ ...a, actions: a.actions.map((x) => (x.id === out.id ? out : x)) }));
      if (decision === "approved" && action.kind === "share-screen") onRequestShare?.();
      if (decision === "approved" && action.kind === "summarize") void summarize();
    } else setMsg("Decision failed.");
    setBusy("");
  }

  async function summarize() {
    setBusy("sum");
    setMsg("");
    try {
      const res = await fetch(`/api/meet/rooms/${roomId}/summarize${qp}`, { method: "POST" });
      const j = (await res.json()) as { summary?: string; model?: string; error?: string };
      if (res.ok && j.summary) { setSummary(j.summary); setModel(j.model ?? ""); setTab("notes"); }
      else setMsg(j.error ?? "Summary failed.");
    } catch { setMsg("Summary failed."); }
    setBusy("");
  }

  function readAloud() {
    try {
      const text = summary || notes.join(". ");
      if (!text) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0, 1000)));
    } catch { /* speech unavailable */ }
  }

  async function save() {
    setBusy("save");
    setMsg("");
    try {
      const res = await fetch(`/api/meet/rooms/${roomId}/save`, { method: "POST" });
      const j = (await res.json()) as { savedTo?: string; id?: string; error?: string };
      setMsg(res.ok ? `Saved to ${j.savedTo} (${String(j.id).slice(0, 18)}).` : (j.error ?? "Save failed."));
    } catch { setMsg("Save failed."); }
    setBusy("");
  }

  async function deleteMemory() {
    setBusy("delete");
    setMsg("");
    try {
      const res = await fetch(`/api/meet/rooms/${roomId}/memory`, { method: "DELETE" });
      const j = (await res.json()) as { deleted?: boolean; error?: string };
      if (res.ok && j.deleted) {
        setLines([]); setNotes([]); setSummary("");
        setAgent({ enabled: false, thoughts: [], actions: [] });
        setEnabled(false);
        onAgentChangeRef.current?.(false);
        setConfirmDelete(false);
        setMsg("Charie's memory of this room was deleted. An audit tombstone remains on the ticket.");
      } else setMsg(j.error ?? "Delete failed.");
    } catch { setMsg("Delete failed."); }
    setBusy("");
  }

  const pending = agent.actions.filter((a) => a.status === "pending");
  const decided = agent.actions.filter((a) => a.status !== "pending");

  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="tabs" role="tablist" aria-label="War room panel" style={{ marginBottom: 10 }}>
        <button type="button" className={`tab${tab === "transcript" ? " on" : ""}`} onClick={() => setTab("transcript")}>Transcript</button>
        <button type="button" className={`tab${tab === "charie" ? " on" : ""}`} onClick={() => setTab("charie")}>Charie{pending.length > 0 ? ` (${pending.length})` : ""}</button>
        <button type="button" className={`tab${tab === "notes" ? " on" : ""}`} onClick={() => setTab("notes")}>Notes & Actions</button>
      </div>

      {tab === "transcript" && (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>
            {enabled
              ? (transcribe && supported ? "Live transcript on · teammate vs customer from sign-in vs invite." : "Live transcript on · needs Chrome or Edge on this device.")
              : "Live notes are off. Turn them on from the Charie tab (host)."}
          </p>
          <div className="live-lines">
            {lines.length === 0 ? <p className="small muted">Listening… speak and lines appear here.</p> : lines.slice(-30).map((l, i) => (
              <p key={i} className="small"><strong>{l.speaker}</strong> <span className="pill">{l.role}</span> {l.text}</p>
            ))}
          </div>
        </>
      )}

      {tab === "charie" && (
        <>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong className="small">Charie AI {agent.enabled ? "· in this call" : "· not in call"}</strong>
            {canManage && <button type="button" className={agent.enabled ? "danger-ghost sm" : "sm"} disabled={busy !== ""} onClick={toggleAgent}>{busy === "agent" ? "…" : agent.enabled ? "Remove Charie" : "Bring Charie in"}</button>}
          </div>
          <p className="small muted">Charie listens, thinks out loud below, and proposes actions. Nothing runs until a human approves a card.</p>
          <div className="row">
            <label className="row small" style={{ fontWeight: 400 }}>
              <input type="checkbox" checked={voice} onChange={(e) => { setVoice(e.target.checked); if (!e.target.checked) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } onAgentSpeakRef.current?.(false); } }} />
              Charie speaks aloud
            </label>
          </div>
          {pending.map((a) => (
            <div key={a.id} className="consent-card">
              <strong className="small">{a.title}</strong>
              <p className="small muted" style={{ margin: "4px 0 8px" }}>{a.detail}</p>
              <div className="row">
                <button type="button" className="sm" disabled={busy !== ""} onClick={() => decide(a, "approved")}>Approve</button>
                <button type="button" className="secondary sm" disabled={busy !== ""} onClick={() => decide(a, "denied")}>Deny</button>
              </div>
            </div>
          ))}
          {canManage && agent.enabled && (
            <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="secondary sm" disabled={busy !== ""} onClick={() => agentPost({ op: "propose", kind: "investigate" })}>Propose investigation</button>
              <button type="button" className="secondary sm" disabled={busy !== ""} onClick={() => agentPost({ op: "propose", kind: "share-screen" })}>Ask for screen share</button>
              <button type="button" className="secondary sm" disabled={busy !== ""} onClick={() => agentPost({ op: "propose", kind: "workorder" })}>Propose fix task</button>
            </div>
          )}
          <div className="section-label" style={{ marginTop: 12 }}>Charie is thinking</div>
          {agent.thoughts.length === 0 ? <p className="small muted">No thoughts yet. Bring Charie in and talk through the issue.</p> : agent.thoughts.slice(-14).map((t, i) => (
            <p key={i} className="thought"><b>{t.at.slice(11, 16)}</b> · {t.text}</p>
          ))}
          {decided.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 12 }}>Decisions</div>
              {decided.slice(-6).map((a) => (
                <p key={a.id} className="small" style={{ margin: "4px 0" }}>
                  {a.status === "done" ? "✓" : a.status === "denied" ? "✕" : "!"} {a.title} <span className="muted">· {a.status}</span>
                  {a.result?.startsWith("/") && <> · <a href={a.result}>open</a></>}
                </p>
              ))}
            </>
          )}
        </>
      )}

      {tab === "notes" && (
        <>
          {notes.length > 0 && (
            <div>
              <div className="section-label">Action notes</div>
              <ul className="small" style={{ marginTop: 0 }}>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
          {summary && (
            <div>
              <div className="section-label">Summary {model && <span className="muted">· {model}</span>}</div>
              <p className="small" style={{ whiteSpace: "pre-wrap" }}>{summary}</p>
            </div>
          )}
          <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" className="secondary sm" disabled={busy !== "" || lines.length === 0} onClick={summarize}>{busy === "sum" ? "Summarizing…" : "Summarize with Charie"}</button>
            <button type="button" className="secondary sm" disabled={!summary && notes.length === 0} onClick={readAloud}>Read aloud</button>
            {canManage && <button type="button" className="secondary sm" disabled={busy !== "" || lines.length === 0} onClick={save}>{busy === "save" ? "Saving…" : "Save notes"}</button>}
          </div>
          {canManage && (
            <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <div className="section-label">Privacy: Charie&apos;s memory</div>
              <p className="small muted">Export keeps everything Charie holds for this room (transcript, notes, thoughts, decisions). Deleting wipes it and leaves only an audit tombstone on the ticket.</p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <a className="btn secondary sm" href={`/api/meet/rooms/${roomId}/export`}>Export call data</a>
                {!confirmDelete ? (
                  <button type="button" className="danger-ghost sm" onClick={() => setConfirmDelete(true)}>Delete Charie&apos;s memory</button>
                ) : (
                  <>
                    <button type="button" className="danger sm" disabled={busy !== ""} onClick={deleteMemory}>{busy === "delete" ? "Deleting…" : "Confirm delete"}</button>
                    <button type="button" className="ghost sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {msg && <p className="small" style={{ color: "var(--accent-ink)", marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

