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

export function charieShouldReply(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\bcharie\b/i.test(t)) return true;
  return t.endsWith("?");
}
