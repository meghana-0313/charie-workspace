// Charie Meet: native video rooms. Mesh WebRTC (camera, mic, screen share)
// with portal hosted signaling (polling, no sockets needed). Peers join from
// any tab or device on this workspace; media stays peer to peer.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeetSignal } from "@/lib/types";
import { stalePeerIds, touchPeer } from "@/lib/presence";
import { Icon } from "./icons";
import { charieAskLine, speakableText } from "@/lib/room-status";

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

export function MeetRoom({ roomId, roomTitle, token = "", initialName = "", transcribeOk = true, initialEnded = false, savedTranscript = [], savedNotes = [], savedSummary = "", savedScreenLog = [] }: { roomId: string; roomTitle: string; token?: string; initialName?: string; transcribeOk?: boolean; initialEnded?: boolean; savedTranscript?: Array<{ speaker: string; role: string; text: string; at: string }>; savedNotes?: string[]; savedSummary?: string; savedScreenLog?: Array<{ at: string; text: string }> }) {
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [visionOn, setVisionOn] = useState(false);
  const [name, setName] = useState(initialName);
  const qp = token ? `?token=${encodeURIComponent(token)}` : "";
  const sq = (since: number) => (token ? `?token=${encodeURIComponent(token)}&since=${since}` : `?since=${since}`);
  const [joined, setJoined] = useState(false);
  const [ended, setEnded] = useState(initialEnded);
  const [ending, setEnding] = useState(false);
  const lastSeen = useRef<Record<string, number>>({});
  const [agentOn, setAgentOn] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [startMuted, setStartMuted] = useState(false);
  const [startCamOff, setStartCamOff] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [previewErr, setPreviewErr] = useState("");
  const localVideo = useRef<HTMLVideoElement>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const joinedRef = useRef(false);
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
    delete lastSeen.current[id];
    setPeers((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  };

  // Leave must survive tab close: keepalive lets the request finish while
  // the page unloads (a plain fetch is cancelled and leaves a ghost tile).
  const sendLeave = () => {
    fetch(`/api/meet/rooms/${roomId}/signal${qp}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: me.current, to: "*", kind: "leave", payload: "" }),
      keepalive: true,
    }).catch(() => {});
  };

  const teardown = () => {
    for (const id of Object.keys(pcs.current)) pcs.current[id].close();
    pcs.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    // Screen share lives outside streamRef: stop it too or the browser
    // keeps capturing the screen after Leave / End / unmount.
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setSharing(false);
    try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
    joinedRef.current = false;
    lastSeen.current = {};
    setPeers({});
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
    lastSeen.current = touchPeer(lastSeen.current, s.from, Date.now());
    if (s.kind === "ping") return;
    if (s.kind === "end") {
      teardown();
      setStartCamOff(true);
      setCamOff(true);
      setJoined(false);
      setEnded(true);
      return;
    }
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
    // Presence heartbeat + ghost sweep: peers who stop pinging (closed tab,
    // crashed browser, lost leave signal) lose their tile automatically.
    const heartbeat = setInterval(() => { void send("*", "ping"); }, 8000);
    const sweep = setInterval(() => {
      for (const id of stalePeerIds(lastSeen.current, Date.now())) closePeer(id);
    }, 5000);
    const bye = () => { stopPoll.current = true; sendLeave(); };
    window.addEventListener("beforeunload", bye);
    return () => {
      clearInterval(timer);
      clearInterval(heartbeat);
      clearInterval(sweep);
      window.removeEventListener("beforeunload", bye);
      sendLeave();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, roomId]);

  useEffect(() => {
    if (localVideo.current && streamRef.current) localVideo.current.srcObject = streamRef.current;
  }, [joined, camOff]);

  // Pre-join device preview: see yourself before anyone else does. The same
  // stream is reused on Join so the permission prompt only fires once.
  useEffect(() => {
    if (joined) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: !audioOnly && !startCamOff, audio: true });
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
      // Leaving the page before Join must release the camera/mic, or the
      // browser keeps them live. Skipped once joined: the joined effect's
      // teardown owns the stream from there.
      if (!joinedRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [joined, audioOnly, startCamOff]);

  // Pre-join toggles act on the preview immediately: checking "Camera off"
  // stops the preview track (camera light out) instead of only applying at
  // join time. Unchecking re-acquires through the preview effect above.
  useEffect(() => {
    if (joined) return;
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = !startMuted; });
    if (startCamOff) {
      stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      if (previewVideo.current) previewVideo.current.srcObject = null;
    } else if (!audioOnly && stream.getVideoTracks().length === 0) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((fresh) => {
        if (!streamRef.current) return;
        streamRef.current.addTrack(fresh.getVideoTracks()[0]);
        if (previewVideo.current) previewVideo.current.srcObject = streamRef.current;
      }).catch(() => {});
    }
  }, [joined, audioOnly, startMuted, startCamOff]);

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
      // Keep the preview stream when joining with camera off: its video track
      // was already stopped on the pre-join screen, so nobody re-prompts.
      if (!stream || (hasVideo && audioOnly) || (!hasVideo && !audioOnly && !startCamOff)) {
        stream?.getTracks().forEach((t) => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({ video: !audioOnly, audio: true });
        streamRef.current = stream;
      }
      stream.getAudioTracks().forEach((t) => { t.enabled = !startMuted; });
      stream.getVideoTracks().forEach((t) => { t.enabled = !startCamOff; });
      setMuted(startMuted);
      setCamOff(audioOnly || startCamOff);
      nameRef.current = name.trim();
      joinedRef.current = true;
      setJoined(true);
      await send("*", "join", JSON.stringify({ name: nameRef.current, role: token ? "guest" : "member" }));
    } catch {
      setError("Camera or mic blocked. Allow access in the browser, then retry.");
    }
  };

  const leave = () => {
    // Members: save transcript/notes/summary on the room first, so coming
    // back to this room shows the previous session, not a blank room.
    if (!token) {
      fetch(`/api/meet/rooms/${roomId}/snapshot`, { method: "POST", keepalive: true }).catch(() => {});
    }
    sendLeave();
    teardown();
    setStartCamOff(true);
    setCamOff(true);
    setJoined(false);
  };

  const endForEveryone = async () => {
    if (!confirm("End this meeting for everyone? All participants, guests included, will be disconnected.")) return;
    setEnding(true);
    const res = await fetch(`/api/meet/rooms/${roomId}/end`, { method: "POST" }).catch(() => null);
    setEnding(false);
    if (res?.ok) {
      teardown();
      setStartCamOff(true);
      setCamOff(true);
      setJoined(false);
      setEnded(true);
    } else {
      setError("Only the host who created this room can end it for everyone.");
    }
  };

  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  };

  // Camera off must really turn the camera off: stop the track (light goes
  // out, peers get no frames) instead of only muting it. Turning back on
  // re-acquires the camera and re-attaches it to every peer connection.
  const toggleCam = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (!camOff) {
      for (const pc of Object.values(pcs.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(null).catch(() => {});
      }
      stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      if (localVideo.current) localVideo.current.srcObject = stream;
      setCamOff(true);
      return;
    }
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = fresh.getVideoTracks()[0];
      stream.addTrack(track);
      for (const pc of Object.values(pcs.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(track).catch(() => {});
        else pc.addTrack(track, stream);
      }
      if (localVideo.current) localVideo.current.srcObject = stream;
      setCamOff(false);
    } catch {
      setError("Camera blocked. Allow access in the browser, then retry.");
    }
  };

  // Watch mode: sample the shared screen locally every 3 seconds (tiny
  // offscreen canvas, no network). A full frame goes to Charie only when
  // the pixels actually changed, at most every 4s, plus a 30s heartbeat -
  // so she follows the screen near-continuously without paying a model
  // call for a static screen, and every sent frame lands in her screen
  // memory for "what happened earlier?" questions.
  useEffect(() => {
    if (!visionOn || !sharing || !agentOn) return;
    let stop = false;
    let inFlight = false;
    let lastPost = 0;
    let prev: Uint8ClampedArray | null = null;
    const sample = document.createElement("canvas");
    sample.width = 32;
    sample.height = 18;
    const sctx = sample.getContext("2d", { willReadFrequently: true });
    const send = async (video: HTMLVideoElement) => {
      inFlight = true;
      lastPost = Date.now();
      try {
        const canvas = document.createElement("canvas");
        const w = Math.min(video.videoWidth, 960);
        canvas.width = w;
        canvas.height = Math.round(w * (video.videoHeight / video.videoWidth));
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        await fetch(`/api/meet/rooms/${roomId}/vision${qp}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: canvas.toDataURL("image/jpeg", 0.72), question: "What changed on this screen? Flag any error.", mode: "watch" }),
        });
      } catch { /* next tick retries */ }
      inFlight = false;
    };
    const tick = () => {
      if (stop || inFlight) return;
      const video = localVideo.current;
      if (!video || !video.videoWidth || !sctx) return;
      sctx.drawImage(video, 0, 0, 32, 18);
      let cur: Uint8ClampedArray;
      try { cur = sctx.getImageData(0, 0, 32, 18).data; } catch { return; }
      let changed = prev === null;
      if (prev) {
        let diff = 0;
        for (let i = 0; i < cur.length; i += 16) diff += Math.abs(cur[i] - prev[i]);
        changed = diff / (cur.length / 16) > 7;
      }
      prev = cur;
      const sincePost = Date.now() - lastPost;
      if ((changed && sincePost >= 4000) || sincePost >= 30000) void send(video);
    };
    const t = setInterval(tick, 3000);
    tick();
    return () => { stop = true; clearInterval(t); };
  }, [visionOn, sharing, agentOn, roomId, qp]);

  const stopSharing = () => {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    if (localVideo.current && streamRef.current) localVideo.current.srcObject = streamRef.current;
    setSharing(false);
    if (spotlight === "local") setSpotlight(null);
  };

  const shareScreen = async () => {
    if (sharing) return;
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenRef.current = screen;
      const track = screen.getVideoTracks()[0];
      for (const pc of Object.values(pcs.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
      }
      if (localVideo.current) {
        localVideo.current.srcObject = screen;
      }
      setSharing(true);
      setSpotlight("local");
      track.onended = async () => {
        screenRef.current = null;
        const cam = streamRef.current?.getVideoTracks()[0] ?? null;
        for (const pc of Object.values(pcs.current)) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(cam);
        }
        if (localVideo.current && streamRef.current) localVideo.current.srcObject = streamRef.current;
        setSharing(false);
      };
    } catch (e) {
      setError(`Screen share failed: ${(e as Error).name === "NotAllowedError" ? "permission denied. Allow screen sharing and try again." : "could not start. Try again."}`);
    }
  };

  if (ended) {
    return (
      <div className="stack">
        <div className="card">
          <div className="card-title">Meeting ended</div>
          <p className="muted small">
            {token
              ? "The host ended this meeting for everyone. Thanks for joining; you can close this tab."
              : "This meeting has ended. Its transcript and notes are saved below, and you can re-open this same room to keep discussing the same issue with full context."}
          </p>
          {!token && (
            <p className="row" style={{ marginBottom: 0 }}>
              <ReopenButton roomId={roomId} />
              <a className="btn secondary" href="/guardian/zoom">Back to Meet</a>
            </p>
          )}
        </div>
        {!token && savedSummary && (
          <div className="card">
            <div className="card-title">Summary</div>
            <p className="small" style={{ whiteSpace: "pre-wrap" }}>{savedSummary}</p>
          </div>
        )}
        {!token && savedNotes.length > 0 && (
          <div className="card">
            <div className="card-title">Notes and actions</div>
            <ul className="small">
              {savedNotes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}
        {!token && savedTranscript.length > 0 && (
          <div className="card">
            <div className="card-title">Transcript ({savedTranscript.length})</div>
            <div className="live-lines" style={{ maxHeight: 380 }}>
              {savedTranscript.map((l, i) => (
                <p key={i} className="small"><strong>{l.speaker}</strong> <span className="muted">({l.role})</span>: {l.text}</p>
              ))}
            </div>
          </div>
        )}
        {!token && savedScreenLog.length > 0 && (
          <div className="card">
            <div className="card-title">Screen memory ({savedScreenLog.length})</div>
            <div className="live-lines" style={{ maxHeight: 300 }}>
              {savedScreenLog.map((e, i) => (
                <p key={i} className="small"><strong>{e.at.slice(11, 16)}</strong> <span className="muted">Charie saw:</span> {e.text}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="stack">
      {!token && savedTranscript.length > 0 && (
        <>
          <div className="card">
            <div className="card-title">Previous session in this room</div>
            <p className="small muted">This room already has a call history. Rejoin below to continue it - Charie keeps the context.</p>
            {savedSummary && <p className="small" style={{ whiteSpace: "pre-wrap" }}>{savedSummary}</p>}
          </div>
          {savedNotes.length > 0 && (
            <div className="card">
              <div className="card-title">Notes and actions</div>
              <ul className="small">{savedNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
          <div className="card">
            <div className="card-title">Transcript ({savedTranscript.length})</div>
            <div className="live-lines" style={{ maxHeight: 380 }}>
              {savedTranscript.map((l, i) => (
                <p key={i} className="small"><strong>{l.speaker}</strong> <span className="muted">({l.role})</span>: {l.text}</p>
              ))}
            </div>
          </div>
          {savedScreenLog.length > 0 && (
            <div className="card">
              <div className="card-title">Screen memory ({savedScreenLog.length})</div>
              <div className="live-lines" style={{ maxHeight: 300 }}>
                {savedScreenLog.map((e, i) => (
                  <p key={i} className="small"><strong>{e.at.slice(11, 16)}</strong> <span className="muted">Charie saw:</span> {e.text}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <div className="card">
        <div className="card-title">Join “{roomTitle}”</div>
        <p className="muted small">{token ? "Step 2 of 2: your check-in is done. " : ""}Camera starts off. Turn it on only if you want to be seen.</p>
        {!audioOnly && !startCamOff && (
          <div className="meet-preview-card">
            <video ref={previewVideo} autoPlay playsInline muted className="meet-preview" aria-label="Camera preview" />
            <span className="meet-name">{name || "You"} (preview)</span>
          </div>
        )}
        {startCamOff && !audioOnly && <div className="meet-preview-card"><div className="meet-wait" style={{ height: "100%" }}>Camera is off. Nobody can see you. Switch Camera off to preview.</div></div>}
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" autoFocus style={{ flex: 1, minWidth: 160 }} />
          <button onClick={join}>{audioOnly ? "Join audio only" : "Join call"}</button>
        </div>
        <div className="stack" style={{ marginTop: 8 }}>
          <MeetSwitch checked={startMuted} onChange={setStartMuted} label="Start muted" />
          <MeetSwitch checked={startCamOff} onChange={setStartCamOff} label="Camera off" disabled={audioOnly} />
          <MeetSwitch checked={audioOnly} onChange={(v) => { setAudioOnly(v); if (v) setStartCamOff(true); }} label="Audio only" />
        </div>
        {previewErr && <p className="small" style={{ color: "var(--danger)" }}>{previewErr}</p>}
        {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
      </div>
    );
  }

  const tiles = Object.values(peers);
  return (
    <div className="war-layout">
      <div className="war-main">
        <div className={`meet-grid${spotlight ? " has-spot" : ""}`}>
          <div className={`meet-tile${spotlight === "local" ? " spot" : ""}`}>
            {audioOnly || camOff ? (
              <div className="meet-wait">
                <span className="initials" style={{ width: 56, height: 56, fontSize: 20 }}>{(nameRef.current || "Y").slice(0, 1).toUpperCase()}</span>
                <span className="small muted">{audioOnly ? "Audio only" : "Camera off"}</span>
              </div>
            ) : <video ref={localVideo} autoPlay playsInline muted />}
            <span className="meet-name">{nameRef.current} (you, {token ? "customer" : "teammate"}){muted ? " · muted" : ""}{sharing ? " · sharing screen" : ""}</span>
            <span className="row" style={{ position: "absolute", right: 8, bottom: 8, gap: 6 }}><LookButton roomId={roomId} qp={qp} getVideo={() => localVideo.current} disabledReason={!visionOn ? "Vision off (Charie tab)" : !agentOn ? "Bring Charie in first" : undefined} /><button type="button" className="secondary sm" onClick={() => setSpotlight((cur) => (cur === "local" ? null : "local"))} aria-pressed={spotlight === "local"}>{spotlight === "local" ? "Exit stage" : "Stage"}</button></span>
          </div>
          {tiles.map((p) => (
            <PeerTile key={p.id} peer={p} onRemove={() => closePeer(p.id)} roomId={roomId} qp={qp} spot={spotlight === p.id} onSpot={() => setSpotlight((cur) => (cur === p.id ? null : p.id))} visionOn={visionOn} agentOn={agentOn} />
          ))}
          {agentOn && (
            <div className="meet-tile" style={{ background: "radial-gradient(120% 120% at 50% 0%, #0b2e2a 0%, #071417 70%)", borderColor: "rgba(110,231,216,.45)" }}>
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
          <button type="button" className={`meet-ctrl${muted ? " off" : ""}`} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Unmute" : "Mute"} onClick={toggleMute}><span className="meet-ctrl-dot"><Icon name={muted ? "mic-off" : "mic"} size={20} /></span>{muted ? "Unmute" : "Mute"}</button>
          <button type="button" className={`meet-ctrl${camOff ? " off" : ""}`} aria-pressed={camOff} aria-label={camOff ? "Turn camera on" : "Turn camera off"} title={camOff ? "Camera on" : "Camera off"} onClick={toggleCam}><span className="meet-ctrl-dot"><Icon name={camOff ? "video-off" : "video"} size={20} /></span>{camOff ? "Camera on" : "Camera off"}</button>
          <button type="button" className="meet-ctrl" aria-label={sharing ? "Stop sharing" : "Share screen"} title={sharing ? "Stop sharing" : "Share screen"} onClick={sharing ? stopSharing : shareScreen}><span className="meet-ctrl-dot"><Icon name="screen" size={20} /></span>{sharing ? "Stop" : "Share"}</button>
          {!token && <InviteButton roomId={roomId} />}
          <button type="button" className="meet-ctrl leave" aria-label="Leave call" title="Leave call" onClick={leave}><span className="meet-ctrl-dot"><Icon name="phone" size={20} /></span>Leave</button>
          {!token && <button type="button" className="danger" onClick={endForEveryone} disabled={ending}>{ending ? "Ending…" : "End for everyone"}</button>}
        </div>
        {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
        <p className="muted small">{tiles.length === 0 ? (token ? "You are in. Waiting for the host to join." : "Alone here. Invite a guest with the button above, or send the room link to your team.") : `${tiles.length} peer(s) connected.`}</p>
      </div>
      <aside className="side-panel">
        <LiveNotes
          roomId={roomId}
          token={token}
          canManage={!token}
          transcribe={transcribeOk}
          localName={nameRef.current || name}
          visionOn={visionOn}
          onVisionChange={setVisionOn}
          onAgentChange={setAgentOn}
          onAgentSpeak={setAgentSpeaking}
          onRequestShare={() => { void shareScreen().catch(() => {}); }}
        />
      </aside>
    </div>
  );
}

export function ReopenButton({ roomId }: { roomId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await fetch(`/api/meet/rooms/${roomId}/reopen`, { method: "POST" }).catch(() => null);
          if (res?.ok) { location.reload(); return; }
          const j = (await res?.json().catch(() => ({}))) as { error?: string };
          setBusy(false);
          setError(j.error ?? "Could not re-open this room. Try again.");
        }}
      >
        {busy ? "Re-opening…" : "Re-open room"}
      </button>
      {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
    </>
  );
}

/** Capture one frame of a tile and ask Charie to describe it aloud. */
export function LookButton({ roomId, qp, getVideo, label = "Charie, look", disabledReason }: { roomId: string; qp: string; getVideo: () => HTMLVideoElement | null; label?: string; disabledReason?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function look() {
    const video = getVideo();
    if (!video || busy) { setErr("No video to look at yet."); return; }
    setBusy(true); setErr("");
    try {
      const canvas = document.createElement("canvas");
      const w = Math.min(video.videoWidth || 640, 960);
      canvas.width = w;
      canvas.height = Math.round(w * ((video.videoHeight || 540) / (video.videoWidth || 640)));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.72);
      const res = await fetch(`/api/meet/rooms/${roomId}/vision${qp}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, question: "What do you see on this screen, and where should we click next?" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setErr(j.error ?? "Charie could not look right now.");
    } catch { setErr("Charie could not look right now."); }
    setBusy(false);
  }
  return (
    <span className="row" style={{ gap: 6 }}>
      <button type="button" className="secondary sm" onClick={look} disabled={busy || Boolean(disabledReason)} title={disabledReason ?? label}>{busy ? "Looking…" : label}</button>
      {disabledReason && <span className="small muted">{disabledReason}</span>}
      {err && <span className="small" style={{ color: "var(--danger)" }}>{err}</span>}
    </span>
  );
}

function PeerTile({ peer, onRemove, roomId, qp, spot, onSpot, visionOn, agentOn }: { peer: Peer; onRemove: () => void; roomId: string; qp: string; spot?: boolean; onSpot?: () => void; visionOn?: boolean; agentOn?: boolean }) {
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
    <div className={`meet-tile${spot ? " spot" : ""}`}>
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
      {peer.stream && <span className="row" style={{ position: "absolute", right: 8, bottom: 8, gap: 6 }}><LookButton roomId={roomId} qp={qp} getVideo={() => ref.current} disabledReason={!visionOn ? "Vision off (Charie tab)" : !agentOn ? "Bring Charie in first" : undefined} /><button type="button" className="secondary sm" onClick={onSpot} aria-pressed={spot}>{spot ? "Exit stage" : "Stage"}</button></span>}
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


/** Smooth accessible toggle used for every Meet option. */
export function MeetSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="switch-row-label">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`switch${checked ? " on" : ""}`} onClick={() => onChange(!checked)}><i /></button>
      <span className="small">{label}</span>
    </span>
  );
}

// One shared request per (room, line): the warmup, the voice test, and the
// in-call speaker all await the SAME promise, so a cold voice service is
// only ever paid once and never raced by duplicate requests.
const ttsInflight = new Map<string, Promise<Blob>>();
function fetchTts(roomId: string, qp: string, text: string): Promise<Blob> {
  const key = `${roomId}|${text}`;
  const existing = ttsInflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    const res = await fetch(`/api/meet/rooms/${roomId}/tts${qp}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`voice ${res.status}`);
    return res.blob();
  })();
  ttsInflight.set(key, p);
  p.catch(() => ttsInflight.delete(key));
  return p;
}

/** One-click voice check, run inside the click gesture so audio can play. */
export function TestVoice({ roomId, qp, onNote }: { roomId: string; qp: string; onNote: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  // Warm the voice service as soon as this panel renders, so the click
  // below plays from cache instead of paying a 10-30s cold start.
  const warmed = useRef(false);
  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;
    void fetchTts(roomId, qp, "Hi, this is Charie.").catch(() => {});
  }, [roomId, qp]);
  async function test() {
    if (busy) return;
    setBusy(true);
    const started = Date.now();
    try {
      let blob: Blob;
      try {
        blob = await fetchTts(roomId, qp, "Hi, this is Charie.");
      } catch (e) {
        onNote(`Voice test failed: the voice service answered ${(e as Error).message.replace("voice ", "")}. Check CHARIE_TTS_URL and the Modal deployment, then retry.`);
        setBusy(false);
        return;
      }
      const readyMs = Date.now() - started;
      if (blob.size < 100) { onNote("Voice test failed: the voice service returned an empty audio file."); setBusy(false); return; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      // Wait until playback actually finishes: "played" must mean heard.
      const played = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 15000);
        audio.onended = () => { clearTimeout(timer); resolve(true); };
        audio.onerror = () => { clearTimeout(timer); resolve(false); };
        audio.play().catch(() => { clearTimeout(timer); resolve(false); });
      });
      URL.revokeObjectURL(url);
      if (played) onNote(readyMs > 4000
        ? `Voice test OK, but the voice service took ${Math.round(readyMs / 1000)}s to answer - that is a cold start on the Modal TTS side, not your browser. It stays warm while the call is open; if every first line is this slow, keep one container warm in Modal.`
        : `Voice test OK: voice ready in ${readyMs}ms and played end to end. She will sound like this in the call.`);
      else onNote("Voice test failed: audio could not play in this browser. Click once anywhere, check your output device and volume, then retry.");
    } catch {
      onNote("Voice test failed: the voice service is unreachable. Check CHARIE_TTS_URL, then retry.");
    }
    setBusy(false);
  }
  return (
    <div className="row" style={{ marginTop: 6 }}>
      <button type="button" className="secondary sm" onClick={test} disabled={busy}>{busy ? "Testing…" : "Test voice"}</button>
      <span className="small muted">Hearing this means playback works.</span>
    </div>
  );
}

/** Type to Charie in a call, exactly like sending her a chat message. */
export function AskCharie({ roomId, qp, name }: { roomId: string; qp: string; name: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const line = charieAskLine(text);
    if (!line || busy) return;
    setBusy(true); setErr("");
    const res = await fetch(`/api/meet/rooms/${roomId}/live${qp}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: line, name }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setText("");
    else setErr("Charie did not get that. Bring Charie in first, then ask again.");
  }
  return (
    <form onSubmit={send} style={{ marginTop: 8 }}>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Charie anything…" aria-label="Ask Charie" style={{ flex: 1, minWidth: 0 }} />
        <button type="submit" className="sm" disabled={busy || !text.trim()}>{busy ? "Asking…" : "Ask"}</button>
      </div>
      {err && <p className="small" style={{ color: "var(--danger)" }}>{err}</p>}
    </form>
  );
}

/** War-room side panel: Transcript | Charie (thinking + consent cards) |
 *  Notes & Actions. Charie only acts after a human approves a card. */
export function LiveNotes({ roomId, token = "", canManage, transcribe, localName, onAgentChange, onAgentSpeak, onRequestShare, visionOn = false, onVisionChange }: {
  roomId: string; token?: string; canManage: boolean; transcribe: boolean; localName: string;
  onAgentChange?: (on: boolean) => void; onAgentSpeak?: (speaking: boolean) => void; onRequestShare?: () => void;
  visionOn?: boolean; onVisionChange?: (v: boolean) => void;
}) {
  const qp = token ? `?token=${encodeURIComponent(token)}` : "";
  const [tab, setTab] = useState<"transcript" | "charie" | "notes">("charie");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lines, setLines] = useState<LiveLineView[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [model, setModel] = useState("");
  const [agent, setAgent] = useState<AgentStateView>({ enabled: false, thoughts: [], actions: [] });
  const [voice, setVoice] = useState(true);
  const [voiceNote, setVoiceNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [supported] = useState(() => typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  const nameRef = useRef(localName);
  nameRef.current = localName;
  const spokenRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef(false);
  voiceRef.current = voice;
  const onAgentChangeRef = useRef(onAgentChange);
  onAgentChangeRef.current = onAgentChange;
  const onAgentSpeakRef = useRef(onAgentSpeak);
  onAgentSpeakRef.current = onAgentSpeak;

  // Warm Charie's voice on panel load, long before anyone tests it.
  useEffect(() => {
    void fetchTts(roomId, qp, "Hi, this is Charie.").catch(() => {});
  }, [roomId, qp]);

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
          setLines((prev) => (JSON.stringify(prev) === JSON.stringify(j.lines ?? []) ? prev : (j.lines ?? [])));
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
    const t = setInterval(poll, 800);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [roomId, qp]);

  // Browsers block audio until a human gesture: the first click anywhere
  // in the room primes speech + audio playback so Charie is audible.
  useEffect(() => {
    const unlock = () => {
      try { window.speechSynthesis?.resume(); } catch { /* noop */ }
      try {
        const a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
        void a.play().catch(() => {});
      } catch { /* noop */ }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const speakingRef = useRef(false);
  const [speakTick, setSpeakTick] = useState(0);
  const lastFailedRef = useRef("");

  // Charie speaks her transcript lines aloud when voice is on. One line at
  // a time, in order. Poll re-renders never cancel playback: a line is only
  // marked spoken once, when its playback actually starts.
  useEffect(() => {
    if (!voiceRef.current || speakingRef.current) return;
    const agentLines = lines.filter((l) => l.role === "agent");
    if (agentLines.length < spokenRef.current) spokenRef.current = agentLines.length;
    // Never read out a backlog: if replies piled up while the voice service
    // was slow, skip straight to the newest one instead of reciting them all.
    if (agentLines.length - spokenRef.current > 1) spokenRef.current = agentLines.length - 1;
    const next = agentLines[spokenRef.current];
    if (!next) return;
    const text = speakableText(next.text);
    spokenRef.current += 1;
    if (!text) { setSpeakTick((n) => n + 1); return; }
    speakingRef.current = true;
    onAgentSpeakRef.current?.(true);
    const done = () => {
      speakingRef.current = false;
      onAgentSpeakRef.current?.(false);
      setSpeakTick((n) => n + 1);
    };
    const browserFallback = () => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        u.voice = voices.find((v) => /male|david|daniel|george|michael/i.test(v.name) && v.lang.startsWith("en")) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
        u.pitch = 0.92;
        u.rate = 1.02;
        u.onend = done;
        u.onerror = () => { lastFailedRef.current = text; setVoiceNote("Browser voice failed too. Use Test voice below to see the exact error."); done(); };
        window.speechSynthesis.speak(u);
      } catch {
        lastFailedRef.current = text;
        setVoiceNote("No voice could play. Use Test voice below to see the exact error.");
        done();
      }
    };
    (async () => {
      try {
        let blob: Blob;
        try {
          blob = await fetchTts(roomId, qp, text);
        } catch (e) {
          setVoiceNote(`Human voice service answered ${(e as Error).message.replace("voice ", "")}, using the browser voice for this line.`);
          browserFallback();
          return;
        }
        const audio = new Audio(URL.createObjectURL(blob));
        audioRef.current = audio;
        audio.onended = done;
        audio.onerror = () => { setVoiceNote("Audio file could not play, using the browser voice."); browserFallback(); };
        setVoiceNote("");
        await audio.play().catch(() => {
          lastFailedRef.current = text;
          setVoiceNote("Audio was blocked. Click anywhere in the room once, then press Test voice.");
          browserFallback();
        });
      } catch {
        setVoiceNote("Human voice service unreachable, using the browser voice.");
        browserFallback();
      }
    })();
  }, [lines, speakTick, voice, roomId, qp]);

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
  const pendingCount = pending.length;
  useEffect(() => {
    if (pendingCount > 0) setTab("charie");
  }, [pendingCount]);
  const decided = agent.actions.filter((a) => a.status !== "pending");

  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="tabs" role="tablist" aria-label="War room panel" style={{ marginBottom: 10 }}>
        <button type="button" className={`tab${tab === "charie" ? " on" : ""}`} onClick={() => setTab("charie")}>Charie{pending.length > 0 ? ` (${pending.length})` : ""}</button>
        <button type="button" className={`tab${tab === "transcript" ? " on" : ""}`} onClick={() => setTab("transcript")}>Transcript</button>
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
          <p className="small muted">She can watch a shared screen (use Charie, look on a tile) and tell you where to click. Browsers cannot give any web app control of your mouse or keyboard, so she guides you instead - and when the product itself needs driving, Investigate lets her drive it in her own browser.</p>
          <MeetSwitch checked={voice} onChange={(v) => { setVoice(v); if (!v) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } audioRef.current?.pause(); onAgentSpeakRef.current?.(false); } }} label="Charie speaks aloud" />
          {voiceNote && <p className="small" style={{ color: "var(--warn)", margin: "4px 0 0" }} role="status">{voiceNote}</p>}
          <TestVoice roomId={roomId} qp={qp} onNote={setVoiceNote} />
          <MeetSwitch checked={visionOn} onChange={(v) => onVisionChange?.(v)} label="Charie can look at screens" />
          <p className="small muted" style={{ margin: "2px 0 0" }}>{visionOn ? "Vision on: Charie watches a shared screen continuously (she checks locally every few seconds and only sends frames that changed), remembers what she saw with timestamps, and speaks up when she spots a problem. Ask her what happened earlier and she answers from that memory. Charie, look on any tile makes her describe a frame out loud right away." : "Vision off: Charie cannot see any screen until you switch this on and bring her in."}</p>
          <AskCharie roomId={roomId} qp={qp} name={localName} />
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

