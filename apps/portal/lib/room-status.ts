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
export function screenVisionReply(visionText: string | null): string {
  if (visionText) {
    return `I can see the last frame shared with me: ${visionText.slice(0, 220)} If it changed, share again and press Charie, look and I will check the new frame.`;
  }
  return "I can't see your screen live yet. I only see a frame when you share your screen, turn on Charie can look at screens in the Charie tab, and press Charie, look. Share now and I will take a look.";
}

export function charieShouldReply(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\bchari(?:e)?\b/i.test(t)) return true;
  if (/\b(how are you|how's it going|good morning|good afternoon|good evening|hello|hi there)\b/i.test(t) && t.length < 60) return true;
  return t.endsWith("?");
}
