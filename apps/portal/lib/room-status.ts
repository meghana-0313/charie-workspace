// Pure helpers for Meet rooms: status derivation and Charie reply triggers.
// Kept dependency-free so they can be unit tested without the store.

export type MeetRoomStatus = "Open" | "Ended";

/** A room is Ended exactly when the host ended it for everyone. */
export function meetRoomStatus(room: { endedAt?: string }): MeetRoomStatus {
  return room.endedAt ? "Ended" : "Open";
}

/**
 * Charie answers spoken lines that are questions or address her by name.
 * Ordinary statements are only tracked for notes, so she never spams a call.
 */
/**
 * Full date and time for one transcript line, so anyone reading a saved
 * or live transcript can tell when something was discussed, not just
 * what: "04 Nov 2026, 17:22:31". Empty string for an unparseable stamp.
 */
export function transcriptStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

/** A typed "Ask Charie" line from the Meet panel always addresses Charie. */
export function charieAskLine(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return /\bcharie\b/i.test(t) ? t : `Charie, ${t}`;
}

/** Strip anything a voice should never read aloud (markdown, links, ids). */
export function speakableText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "the link in the chat")
    .replace(/\/(tickets|repos|guardian)\/[A-Za-z0-9_-]+/g, "the page in the workspace")
    .replace(/\btkt_[a-z0-9]+\b/gi, "that ticket")
    .replace(/[`#>*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/**
 * Spoken replies in a live call answer only what was asked: at most two
 * sentences and about 260 characters, however verbose the model was. A
 * call is a conversation, not a report - extra narration is cut, the
 * direct answer is never reworded.
 */
export function clampCallReply(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [clean];
  const kept = sentences.map((s) => s.trim()).filter(Boolean).slice(0, 2).join(" ");
  if (kept.length <= 260) return kept;
  const cut = kept.lastIndexOf(" ", 260);
  return (cut > 80 ? kept.slice(0, cut) : kept.slice(0, 260)).trim() + "...";
}

/** A participant is asking whether Charie can see their screen. These get a
 *  deterministic answer from real vision state, never a model guess. */
export function isScreenSeeQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return /(can|could|do|did) you (not )?(see|watch|look)|see (my|the|this) screen|see it now|what (are|do) you (see|looking)|looking at/.test(t);
}

/**
 * The only honest screen answers. `visionText` is the last frame Charie
 * actually captured (Charie, look / vision re-check); null means she has
 * never seen a frame in this room and must say so.
 */
export function screenVisionReply(visionText: string | null, capturedAt?: string | null, nowISO?: string): string {
  if (visionText) {
    const ageSec = capturedAt && nowISO ? Math.max(0, Math.round((Date.parse(nowISO) - Date.parse(capturedAt)) / 1000)) : 0;
    const when = capturedAt ? capturedAt.slice(11, 19) : "";
    if (ageSec > 25) {
      return `My last captured frame is from ${when}, about ${ageSec} seconds ago, so it may be behind what you are doing now: ${visionText.slice(0, 200)} Give me a few seconds on the new screen and I will catch up.`;
    }
    return `As of ${when || "just now"} I can see: ${visionText.slice(0, 220)}`;
  }
  return "I can't see your screen live yet. I only see a frame when you share your screen, turn on Charie can look at screens in the Charie tab, and press Charie, look. Share now and I will take a look.";
}

/** Asking about the past ("what happened at 10:32?", "what was on screen earlier?"). */
export function isScreenHistoryQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return /what happened|what was on|what did (you|it) (see|show)|earlier|before that|at \d{1,2}:\d{2}|screen (history|earlier|before)/.test(t);
}

/** Extract an HH:MM time from a question, if one is mentioned. */
export function screenQuestionTime(text: string): string | null {
  const m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export interface ScreenLogEntry { at: string; text: string }

/**
 * Deterministic answer from the recorded screen memory. Never invents:
 * no entry near the asked time means saying exactly that.
 */
export function screenHistoryReply(log: ScreenLogEntry[], askedTime: string | null, nowISO: string): string {
  if (log.length === 0) {
    return "I have no screen memory for this call yet. I only remember frames after you share your screen with vision on, so share and I will start remembering from there.";
  }
  const fmt = (iso: string) => iso.slice(11, 16);
  if (!askedTime) {
    const recent = log.slice(-3).map((e) => `${fmt(e.at)}: ${e.text.slice(0, 140)}`).join(" ");
    return `Here is what I remember seeing, latest last. ${recent}`;
  }
  const today = nowISO.slice(0, 10);
  const target = `${today}T${askedTime}:00`;
  const atOrBefore = [...log].reverse().find((e) => e.at.slice(0, 16) <= target.slice(0, 16));
  if (!atOrBefore) {
    return `I have no frame from ${askedTime} or earlier in this call. My earliest memory is ${fmt(log[0].at)}: ${log[0].text.slice(0, 180)}`;
  }
  const gapSecs = Math.round((new Date(`${atOrBefore.at.slice(0, 19)}`).getTime() - new Date(`${today}T${askedTime}:00`).getTime()) / 1000);
  if (Math.abs(gapSecs) > 180) {
    return `I have nothing captured right at ${askedTime}; the closest I have is ${fmt(atOrBefore.at)}: ${atOrBefore.text.slice(0, 200)}`;
  }
  return `At ${askedTime} I saw: ${atOrBefore.text.slice(0, 260)} (captured ${fmt(atOrBefore.at)}).`;
}

/**
 * Split a spoken reply into sentence chunks so playback can start on the
 * first sentence while the rest is still synthesizing - no 10s silence
 * before Charie says anything.
 */
export function splitSpeakChunks(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    // Small chunks: first audio after ~one short sentence, not a paragraph.
    if (cur && (cur + " " + s).length > 110) { chunks.push(cur); cur = s; }
    else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) chunks.push(cur);
  // The FIRST chunk is deliberately tiny: her voice starts after one short
  // clause (~a second of synthesis), the rest streams in behind it.
  if (chunks.length > 0 && chunks[0].length > 70) {
    const first = chunks[0];
    const cut = Math.max(first.lastIndexOf(", ", 70), first.lastIndexOf("; ", 70), first.lastIndexOf(" ", 70));
    if (cut > 20) {
      chunks.splice(0, 1, first.slice(0, cut + 1).trim(), first.slice(cut + 1).trim(), ...chunks.slice(1));
    }
  }
  return chunks.slice(0, 5);
}

/**
 * She just described this exact frame out loud (a Look or a watch alert).
 * Re-reading it word for word when asked "can you see?" is the
 * says-the-same-thing-twice bug: confirm briefly instead.
 */
export function shortVisionConfirm(visionText: string): string {
  const firstSentence = (visionText.split(/(?<=[.!?])\s/)[0] ?? visionText).slice(0, 150).trim();
  return `Yep, I'm looking at that same screen: ${firstSentence}`;
}

/**
 * Charie's speaking pace on calls: brisk, like a normal fast conversation
 * (about 1.18x the default synthesis rate), applied identically to the
 * Modal TTS audio (via playbackRate, pitch preserved) and to the browser
 * voice fallback, so she sounds the same on every path.
 */
export const CHARIE_SPEECH_RATE = 1.18;

export function charieShouldReply(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\bchari(?:e)?\b/i.test(t)) return true;
  if (/\b(how are you|how's it going|good morning|good afternoon|good evening|hello|hi there)\b/i.test(t) && t.length < 60) return true;
  return t.endsWith("?");
}
