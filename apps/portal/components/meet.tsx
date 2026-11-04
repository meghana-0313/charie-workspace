// Charie Meet: native video rooms. Mesh WebRTC (camera, mic, screen share)
// with portal hosted signaling (polling, no sockets needed). Peers join from
// any tab or device on this workspace; media stays peer to peer.

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { MeetSignal } from "@/lib/types";
import { stalePeerIds, touchPeer } from "@/lib/presence";
import { Icon } from "./icons";
import { CHARIE_SPEECH_RATE, charieAskLine, isScreenHistoryQuestion, isScreenSeeQuestion, speakableText, splitSpeakChunks, transcriptStamp } from "@/lib/room-status";

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
  // Warm Charie's voice from the moment the room page opens - before the
  // lobby, before joining - so the first test or reply never cold-starts.
  useEffect(() => {
    void fetchTts(roomId, qp, "Hi, this is Charie.").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);
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
  // Preview auto-acquisition is armed only until the user leaves or the
  // call ends. After that the camera must stay off (light out) until the
  // user explicitly turns the lobby camera back on - never reacquire on
  // the way out, which is what kept the camera light on after exiting.
  const [previewArmed, setPreviewArmed] = useState(true);
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
    // Detach the elements too: a stopped stream left in srcObject can
    // hold the device open in some browsers until the element releases it.
    if (localVideo.current) localVideo.current.srcObject = null;
    if (previewVideo.current) previewVideo.current.srcObject = null;
    setPreviewArmed(false);
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
    void (async () => {
      // Prime the cursor past ALL prior signals before handling any: a
      // reopened room must not replay the previous session's "end" (which
      // instantly ended rejoined calls) or its stale peer joins (ghost
      // "teammate" tiles from people who left hours ago).
      try {
        const res = await fetch(`/api/meet/rooms/${roomId}/signal${sq(0)}`, { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as { signals: MeetSignal[] };
          for (const s of j.signals) since.current = Math.max(since.current, s.seq);
        }
      } catch { /* poll below still works from 0 */ }
      await poll();
    })();
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
    if (joined || !previewArmed) return;
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
        if (previewVideo.current) previewVideo.current.srcObject = null;
      }
    };
  }, [joined, audioOnly, startCamOff, previewArmed]);

  // Unmount (sidebar navigation, back button, tab close via SPA route):
  // stopping tracks here is the last guarantee the camera/mic light goes
  // out without needing a page refresh.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
    };
  }, []);

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
        const track = fresh.getVideoTracks()[0];
        if (!streamRef.current || !track) {
          fresh.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current.addTrack(track);
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
      const capturedAt = new Date().toISOString();
      try {
        const canvas = document.createElement("canvas");
        const w = Math.min(video.videoWidth, 720);
        canvas.width = w;
        canvas.height = Math.round(w * (video.videoHeight / video.videoWidth));
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        await fetch(`/api/meet/rooms/${roomId}/vision${qp}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: canvas.toDataURL("image/jpeg", 0.68), question: "In one short sentence: what is on this screen now, and any error?", mode: "watch", fast: true, capturedAt }),
          signal: AbortSignal.timeout(20000),
        });
      } catch { /* next tick retries with a fresher frame */ }
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
                <p key={i} className="small"><span className="muted">{transcriptStamp(l.at)}</span> <strong>{l.speaker}</strong> <span className="muted">({l.role})</span>: {l.text}</p>
              ))}
            </div>
          </div>
        )}
        {!token && savedScreenLog.length > 0 && (
          <div className="card">
            <div className="card-title">Screen memory ({savedScreenLog.length})</div>
            <div className="live-lines" style={{ maxHeight: 300 }}>
              {savedScreenLog.map((e, i) => (
                <p key={i} className="small"><strong>{transcriptStamp(e.at)}</strong> <span className="muted">Charie saw:</span> {e.text}</p>
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
      <div className="card">
        <div className="card-title">Ready to join</div>
        <p className="muted small">{token ? "Step 2 of 2: your check-in is done. " : ""}Camera starts off. Turn it on only if you want to be seen.</p>
        {!audioOnly && !startCamOff && (
          <div className="meet-preview-card">
            <video ref={previewVideo} autoPlay playsInline muted className="meet-preview" aria-label="Camera preview" />
            <span className="meet-name">{name || "You"} (preview)</span>
          </div>
        )}
        {startCamOff && !audioOnly && <div className="meet-preview-card"><div className="meet-wait" style={{ height: "100%" }}>Camera is off. Nobody can see you. Switch Camera off to preview.</div></div>}
        <label className="small muted" htmlFor="meet-name" style={{ display: "block", margin: "10px 0 4px" }}>Your name</label>
        <div className="row" style={{ flexWrap: "nowrap", maxWidth: 430 }}>
          <input id="meet-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meghana" aria-label="Your name" autoFocus style={{ flex: 1, minWidth: 0 }} />
          <button onClick={join} style={{ flex: "none" }}>{audioOnly ? "Join audio only" : "Join call"}</button>
        </div>
        <div className="stack" style={{ marginTop: 8 }}>
          <MeetSwitch checked={startMuted} onChange={setStartMuted} label="Start muted" />
          <MeetSwitch checked={startCamOff} onChange={(v) => { setStartCamOff(v); if (!v) setPreviewArmed(true); }} label="Camera off" disabled={audioOnly} />
          <MeetSwitch checked={audioOnly} onChange={(v) => { setAudioOnly(v); if (v) setStartCamOff(true); }} label="Audio only" />
        </div>
        {previewErr && <p className="small" style={{ color: "var(--danger)" }}>{previewErr}</p>}
        {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
      {!token && savedTranscript.length > 0 && (
        <>
          <div className="card">
            <div className="card-title">Previous session in this room (history below - camera and join are above)</div>
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
                <p key={i} className="small"><span className="muted">{transcriptStamp(l.at)}</span> <strong>{l.speaker}</strong> <span className="muted">({l.role})</span>: {l.text}</p>
              ))}
            </div>
          </div>
          {savedScreenLog.length > 0 && (
            <div className="card">
              <div className="card-title">Screen memory ({savedScreenLog.length})</div>
              <div className="live-lines" style={{ maxHeight: 300 }}>
                {savedScreenLog.map((e, i) => (
                  <p key={i} className="small"><strong>{transcriptStamp(e.at)}</strong> <span className="muted">Charie saw:</span> {e.text}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      </div>
    );
  }

  const tiles = Object.values(peers);
  return (
    <>
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
      <span className="small" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{roomTitle}</span>
      <span className="small muted">{tiles.length + 1} in call{agentOn ? " · Charie is in" : ""}{agentSpeaking ? " · Charie speaking" : ""}</span>
    </div>
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
          <button type="button" className="meet-ctrl" aria-label={sharing ? "Stop sharing" : "Share screen"} title={sharing ? "Stop sharing (the light floating bar is Chrome's own UI and follows Chrome's theme, not Charie's)" : "Share screen"} onClick={sharing ? stopSharing : shareScreen}><span className="meet-ctrl-dot"><Icon name="screen" size={20} /></span>{sharing ? "Stop" : "Share"}</button>
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
          callVideos={[
            { id: "local", name: nameRef.current || name, stream: streamRef.current, local: true },
            ...tiles.map((p) => ({ id: p.id, name: p.name, stream: p.stream })),
          ]}
          agentCard={agentOn ? { speaking: agentSpeaking } : null}
          getScreenFrame={() => {
            const video = localVideo.current;
            if (!sharing || !video || !video.videoWidth) return null;
            const canvas = document.createElement("canvas");
            const w = Math.min(video.videoWidth, 512);
            canvas.width = w;
            canvas.height = Math.round(w * (video.videoHeight / video.videoWidth));
            canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/jpeg", 0.62);
          }}
        />
      </aside>
    </div>
    </>
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
        body: JSON.stringify({ image, question: "What do you see on this screen, and where should we click next?", capturedAt: new Date().toISOString() }),
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
let lastTtsProvider = "";
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
    lastTtsProvider = res.headers.get("x-charie-tts") ?? "";
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
      audio.playbackRate = CHARIE_SPEECH_RATE;
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
        : `Voice test OK: voice ready in ${readyMs}ms and played end to end (served by ${lastTtsProvider || "the configured voice provider"}). She will sound like this in the call.`);
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
export function AskCharie({ roomId, qp, name, onBeforePost }: { roomId: string; qp: string; name: string; onBeforePost?: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const line = charieAskLine(text);
    if (!line || busy) return;
    setBusy(true); setErr("");
    if (onBeforePost) await onBeforePost(text);
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
/**
 * Movable, resizable Charie widget: floats over the call (drag its header anywhere, corner to resize, - to minimize, Max to maximize, Pop out for an always-on-top window)
 * and shows her replies as text the moment they are posted - before the
 * voice finishes - plus her latest visible thought. Replies are the same
 * transcript lines everyone sees, so the widget can never show words she
 * did not actually say.
 */
/** One participant camera for the popped-out widget: same stream the
 *  room tile shows, shrunk. No stream yet means an initials card. */
function MiniVideo({ name, stream, local }: { name: string; stream: MediaStream | null; local?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "#101318", aspectRatio: "16 / 10" }}>
      {stream ? <video ref={ref} autoPlay playsInline muted={local} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span className="initials" style={{ width: 34, height: 34, fontSize: 14 }}>{(name || "?").slice(0, 1).toUpperCase()}</span>
        </div>
      )}
      <span style={{ position: "absolute", left: 6, bottom: 6, background: "rgba(11,12,15,.72)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 4 }}>{name}{local ? " (you)" : ""}</span>
    </div>
  );
}

function CharieWidget({ lines, thoughts, videos, agentCard }: { lines: LiveLineView[]; thoughts: Array<{ at: string; text: string }>; videos?: Array<{ id: string; name: string; stream: MediaStream | null; local?: boolean }>; agentCard?: { speaking: boolean } | null }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(true);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [maxed, setMaxed] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [pip, setPip] = useState<Window | null>(null);
  const replies = lines.filter((l) => l.role === "agent").slice(-3);
  const pipSupported = typeof window !== "undefined" && "documentPictureInPicture" in window;
  useEffect(() => () => { pip?.close(); }, [pip]);
  if (replies.length === 0 && !pip) return null;
  const openPip = async () => {
    try {
      const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window> } }).documentPictureInPicture;
      if (!dpip) return;
      const win = await dpip.requestWindow({ width: 400, height: 360 });
      win.document.title = "Charie";
      win.document.documentElement.className = document.documentElement.className;
      win.document.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "";
      win.document.body.className = document.body.className;
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => win.document.head.appendChild(n.cloneNode(true)));
      win.document.body.style.margin = "0";
      win.document.body.style.background = "var(--surface)";
      win.document.body.style.color = "var(--ink)";
      win.document.body.style.fontFamily = "var(--font-sans)";
      win.addEventListener("pagehide", () => setPip(null));
      setPip(win);
    } catch { /* user closed it or browser refused: stay inline */ }
  };
  const onDown = (e: React.PointerEvent) => {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      setPos({ x: Math.max(4, Math.min(window.innerWidth - 120, ev.clientX - dragRef.current.dx)), y: Math.max(4, Math.min(window.innerHeight - 60, ev.clientY - dragRef.current.dy)) });
    };
    const up = () => { dragRef.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  // Drag the corner handle: width and height follow the pointer, clamped
  // so the widget can never leave the viewport or shrink to nothing.
  const onResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const root = (e.currentTarget as HTMLElement).parentElement;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
    setMaxed(false);
    const move = (ev: PointerEvent) => {
      setSize({
        w: Math.max(260, Math.min(760, window.innerWidth - 16, start.w + ev.clientX - start.x)),
        h: Math.max(130, Math.min(680, window.innerHeight - 16, start.h + ev.clientY - start.y)),
      });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const inner = (
    <>
      <div onPointerDown={pip ? undefined : onDown} style={{ cursor: pip ? "default" : "move", touchAction: "none", padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-overlay)" }}>
        <strong style={{ fontSize: 14 }}>Charie</strong>{pip && <span className="small muted" style={{ marginLeft: 8 }}>on your call</span>}
        <span>
          {!pip && pipSupported && <button type="button" className="ghost sm" onClick={() => void openPip()} aria-label="Pop Charie out into a floating window" title="Pop out: floats over other tabs and apps (Chrome/Edge)">Pop out</button>}
          {pip && <button type="button" className="ghost sm" onClick={() => { pip.close(); setPip(null); }} aria-label="Dock Charie back into the room">Dock</button>}
          {!pip && <button type="button" className="ghost sm" onClick={() => setMaxed((v) => !v)} aria-label={maxed ? "Restore Charie widget size" : "Maximize Charie widget"} title={maxed ? "Restore size" : "Maximize"}>{maxed ? "Restore" : "Max"}</button>}
          {!pip && <button type="button" className="ghost sm" onClick={() => setOpen((v) => !v)} aria-label={open ? "Minimize Charie widget" : "Expand Charie widget"} title={open ? "Minimize" : "Expand"}>{open ? "-" : "+"}</button>}
        </span>
      </div>
      {open && (
        <div style={{ padding: "8px 10px", overflowY: "auto", ...(size || maxed ? { flex: 1 } : { maxHeight: pip ? undefined : 260 }) }}>
          {pip && (videos?.length || agentCard) ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
              {(videos ?? []).map((v) => <MiniVideo key={v.id} name={v.name} stream={v.stream} local={v.local} />)}
              {agentCard && (
                <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "radial-gradient(120% 120% at 50% 0%, #0b2e2a 0%, #071417 70%)", aspectRatio: "16 / 10", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="orb-wrap" style={{ width: 54, height: 54 }}>
                    <span className="orb-ring" />
                    <span className="orb-core" />
                    <span className="orb-eyes"><i /><i /></span>
                  </div>
                  <span style={{ position: "absolute", left: 6, bottom: 6, background: "rgba(11,12,15,.72)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 4 }}>CHARIE AI - {agentCard.speaking ? "Speaking" : "Listening"}</span>
                </div>
              )}
            </div>
          ) : null}
          {replies.map((l, i) => (
            <p key={i} className="small" style={{ margin: "0 0 6px" }}><span className="muted">{transcriptStamp(l.at)}</span> {l.text}</p>
          ))}
          {thoughts.length > 0 && <p className="small muted" style={{ margin: 0 }}>Thinking: {thoughts[thoughts.length - 1].text}</p>}
          <p className="small muted" style={{ margin: "6px 0 0" }}>{pip ? "I am floating over your other tabs and apps. Drag my window edges to resize me, or Dock me to return to the room." : "Drag the header to move me, the corner to resize, - to minimize, Max for full size, or Pop out to float over other tabs and apps while you share."}</p>
          {!pip && <div onPointerDown={onResizeDown} role="separator" aria-label="Resize Charie widget" aria-orientation="horizontal" title="Drag to resize" style={{ position: "absolute", right: 3, bottom: 3, width: 18, height: 18, cursor: "nwse-resize", touchAction: "none", borderRight: "2px solid var(--line-strong)", borderBottom: "2px solid var(--line-strong)", borderBottomRightRadius: 10 }} />}
        </div>
      )}
    </>
  );
  if (pip) return createPortal(<div role="complementary" aria-label="Charie replies" style={{ minHeight: "100%", background: "var(--surface)", color: "var(--ink)" }}>{inner}</div>, pip.document.body);
  return (
    <div role="complementary" aria-label="Charie replies" style={{ position: "fixed", zIndex: 80, display: "flex", flexDirection: "column", width: maxed ? "min(680px, 94vw)" : size ? size.w : "min(340px, 92vw)", height: maxed ? "72vh" : size ? size.h : undefined, ...(pos && !maxed ? { left: pos.x, top: pos.y } : maxed ? { right: 16, top: 72 } : { right: 16, bottom: 108 }), background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.4)", overflow: "hidden" }}>
      {inner}
    </div>
  );
}

export function LiveNotes({ roomId, token = "", canManage, transcribe, localName, onAgentChange, onAgentSpeak, onRequestShare, visionOn = false, onVisionChange, getScreenFrame, callVideos, agentCard }: {
  roomId: string; token?: string; canManage: boolean; transcribe: boolean; localName: string;
  onAgentChange?: (on: boolean) => void; onAgentSpeak?: (speaking: boolean) => void; onRequestShare?: () => void;
  getScreenFrame?: () => string | null;
  callVideos?: Array<{ id: string; name: string; stream: MediaStream | null; local?: boolean }>;
  agentCard?: { speaking: boolean } | null;
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

  // Fresh-frame-first for "what are you seeing right now?" questions:
  // bridge with an instant cached "Looking." while the FAST vision lane
  // captures this exact moment, then the normal line posts and her answer
  // comes from the fresh frame, not stale memory.
  const captureFirstRef = useRef<(text: string) => Promise<boolean>>(async () => false);
  captureFirstRef.current = async (text: string) => {
    if (!isScreenSeeQuestion(text) || isScreenHistoryQuestion(text)) return false;
    const frame = getScreenFrame?.();
    if (!frame) return false;
    if (voiceRef.current) {
      void (async () => {
        try {
          const blob = await fetchTts(roomId, qp, "Looking.");
          const a = new Audio(URL.createObjectURL(blob));
          a.playbackRate = CHARIE_SPEECH_RATE;
          await a.play().catch(() => {});
        } catch { /* bridge is best-effort */ }
      })();
    }
    try {
      await fetch(`/api/meet/rooms/${roomId}/vision${qp}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: frame, question: text, mode: "watch", fast: true, capturedAt: new Date().toISOString() }),
        signal: AbortSignal.timeout(20000),
      });
      return true;
    } catch { return false; }
  };

  // Warm Charie's voice on panel load, long before anyone tests it.
  useEffect(() => {
    void fetchTts(roomId, qp, "Hi, this is Charie.").catch(() => {});
  }, [roomId, qp]);

  // Leaving the call - End, Leave, or navigating away - must silence her
  // immediately. An <audio> element keeps playing after unmount unless it
  // is explicitly paused, which is why she used to talk over the homepage.
  useEffect(() => {
    return () => {
      speakGenRef.current += 1;
      try { audioRef.current?.pause(); } catch { /* noop */ }
      audioRef.current = null;
      try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
      speakingRef.current = false;
      onAgentSpeakRef.current?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // 350ms: her replies should reach the speaker almost as they land in
    // the transcript, not up to a second later.
    const t = setInterval(poll, 350);
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastFailedRef = useRef("");
  // Barge-in: a generation counter kills current playback instantly. Any
  // chunk still queued for an older generation is dropped, never resumed.
  const speakGenRef = useRef(0);
  const currentSpokenRef = useRef("");
  const linesRef = useRef<LiveLineView[]>([]);
  linesRef.current = lines;
  const interruptRef = useRef<() => void>(() => {});
  interruptRef.current = () => {
    speakGenRef.current += 1;
    try { audioRef.current?.pause(); } catch { /* noop */ }
    audioRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    speakingRef.current = false;
    setIsSpeaking(false);
    onAgentSpeakRef.current?.(false);
    // Drop everything queued: she stops, she does not resume the backlog.
    spokenRef.current = linesRef.current.filter((l) => l.role === "agent").length;
    setSpeakTick((n) => n + 1);
  };

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
    currentSpokenRef.current = text;
    spokenRef.current += 1;
    // Prefetch the next reply while this one plays, so lines follow each
    // other with no synthesis gap between them.
    const upcoming = agentLines[spokenRef.current];
    if (upcoming) {
      // Prefetch ONLY the next line's first chunk - anything more queues
      // ahead of what she is about to say on a single voice container.
      const first = splitSpeakChunks(speakableText(upcoming.text))[0];
      if (first) void fetchTts(roomId, qp, first).catch(() => {});
    }
    if (!text) { setSpeakTick((n) => n + 1); return; }
    speakingRef.current = true;
    setIsSpeaking(true);
    onAgentSpeakRef.current?.(true);
    const gen = speakGenRef.current;
    const done = () => {
      if (gen !== speakGenRef.current) return;
      speakingRef.current = false;
      setIsSpeaking(false);
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
        u.rate = CHARIE_SPEECH_RATE;
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
      // Sentence-by-sentence: the first chunk starts playing as soon as it
      // is synthesized instead of waiting for the whole reply's audio.
      const chunks = splitSpeakChunks(text);
      // Sequential, never parallel: one warm CPU voice container serves
      // requests in turn, so firing all chunks at once makes the FIRST
      // chunk wait behind the rest - the super-slow start users heard.
      for (let i = 0; i < chunks.length; i++) {
        if (gen !== speakGenRef.current) return;
        const blob = await fetchTts(roomId, qp, chunks[i]).catch(() => null);
        if (gen !== speakGenRef.current) return;
        if (!blob) {
          if (i === 0) { setVoiceNote("Human voice service unavailable, using the browser voice for this line."); browserFallback(); }
          return;
        }
        setVoiceNote("");
        const audio = new Audio(URL.createObjectURL(blob));
        audio.playbackRate = CHARIE_SPEECH_RATE;
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.onpause = () => resolve();
          audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(audio.src);
        if (gen !== speakGenRef.current) return;
      }
      done();
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
          // Barge-in on FINAL human speech only - and never on Charie's own
          // voice coming back through the speakers (echo would silence her
          // before she ever speaks, the bug this guard fixes).
          const heard = text.toLowerCase().replace(/[^a-z0-9 ]/g, "");
          const mine = (currentSpokenRef.current || "").toLowerCase().replace(/[^a-z0-9 ]/g, "");
          const echo = mine.length > 8 && (mine.includes(heard.slice(0, 24)) || heard.includes(mine.slice(0, 24)));
          if (!echo) interruptRef.current();
          // Screen question? Capture this exact moment first (fast lane),
          // then post - her answer describes now, not a stale memory.
          void (async () => {
            await captureFirstRef.current(text);
            await fetch(`/api/meet/rooms/${roomId}/live${qp}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ text, name: nameRef.current }),
            }).catch(() => {});
          })();
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
      const u = new SpeechSynthesisUtterance(text.slice(0, 1000));
      u.rate = CHARIE_SPEECH_RATE;
      window.speechSynthesis.speak(u);
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
              <p key={i} className="small"><span className="muted">{transcriptStamp(l.at)}</span> <strong>{l.speaker}</strong> <span className="pill">{l.role}</span> {l.text}</p>
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
          <MeetSwitch checked={voice} onChange={(v) => { setVoice(v); if (!v) interruptRef.current(); }} label="Charie speaks aloud" />
          {isSpeaking && <p style={{ margin: "6px 0 0" }}><button type="button" className="danger-ghost sm" onClick={() => interruptRef.current()}>Stop Charie talking</button> <span className="small muted">or just start talking - she stops mid-sentence.</span></p>}
          {voiceNote && <p className="small" style={{ color: "var(--warn)", margin: "4px 0 0" }} role="status">{voiceNote}</p>}
          <TestVoice roomId={roomId} qp={qp} onNote={setVoiceNote} />
          <MeetSwitch checked={visionOn} onChange={(v) => onVisionChange?.(v)} label="Charie can look at screens" />
          <p className="small muted" style={{ margin: "2px 0 0" }}>{visionOn ? "Vision on: Charie watches a shared screen continuously (she checks locally every few seconds and only sends frames that changed), remembers what she saw with timestamps, and speaks up when she spots a problem. Ask her what happened earlier and she answers from that memory. Charie, look on any tile makes her describe a frame out loud right away." : "Vision off: Charie cannot see any screen until you switch this on and bring her in."}</p>
          <AskCharie roomId={roomId} qp={qp} name={localName} onBeforePost={(t) => captureFirstRef.current(t)} />
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
            <p key={i} className="thought"><b>{transcriptStamp(t.at)}</b> · {t.text}</p>
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
      <CharieWidget lines={lines} thoughts={agent.thoughts} videos={callVideos} agentCard={agentCard} />
    </div>
  );
}

