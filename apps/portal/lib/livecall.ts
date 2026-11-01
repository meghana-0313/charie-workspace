// Ephemeral in-call memory: transcript lines + notes per room.
// Nothing here touches Firestore; Save explicitly persists to a ticket or a
// context doc. Idle rooms are pruned; a restart wipes everything by design.

export interface LiveLine {
  speaker: string;
  role: "teammate" | "customer";
  text: string;
  at: string;
}

interface RoomLive {
  lines: LiveLine[];
  summary: string;
  updatedAt: number;
}

const rooms = new Map<string, RoomLive>();
const MAX_LINES = 120;
const IDLE_MS = 45 * 60 * 1000;

function get(roomId: string): RoomLive {
  let r = rooms.get(roomId);
  if (!r) {
    r = { lines: [], summary: "", updatedAt: Date.now() };
    rooms.set(roomId, r);
  }
  return r;
}

function prune(): void {
  const now = Date.now();
  for (const [id, r] of rooms) {
    if (now - r.updatedAt > IDLE_MS) rooms.delete(id);
  }
}

export function postLine(roomId: string, line: Omit<LiveLine, "at">): LiveLine {
  prune();
  const r = get(roomId);
  const full: LiveLine = { ...line, at: new Date().toISOString() };
  r.lines.push(full);
  r.lines = r.lines.slice(-MAX_LINES);
  r.updatedAt = Date.now();
  return full;
}

/** Heuristic action notes: questions, bug mentions, commitments. */
export function actionNotes(roomId: string): string[] {
  const lines = get(roomId).lines;
  const notes: string[] = [];
  for (const l of lines) {
    const t = l.text.trim();
    if (t.length < 4 || t.length > 220) continue;
    if (t.endsWith("?") && !notes.some((n) => n === `Q (${l.speaker}): ${t}`)) {
      notes.push(`Q (${l.speaker}): ${t}`);
    } else if (/(bug|error|fail|broken|crash|not working|doesn.?t work|issue with)/i.test(t)) {
      notes.push(`Bug (${l.speaker}): ${t}`);
    } else if (/(i.?ll|we.?ll|let.?s|will do|action|todo|follow up)/i.test(t)) {
      notes.push(`Action (${l.speaker}): ${t}`);
    }
    if (notes.length >= 8) break;
  }
  return notes;
}

export function getLive(roomId: string): { lines: LiveLine[]; notes: string[]; summary: string } {
  const r = get(roomId);
  return { lines: r.lines, notes: actionNotes(roomId), summary: r.summary };
}

export function setSummary(roomId: string, summary: string): void {
  get(roomId).summary = summary.slice(0, 2000);
  get(roomId).updatedAt = Date.now();
}

export function clearRoom(roomId: string): void {
  rooms.delete(roomId);
}
