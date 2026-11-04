// Ephemeral in-call memory: transcript lines + notes per room.
// Nothing here touches Firestore; Save explicitly persists to a ticket or a
// context doc. Idle rooms are pruned; a restart wipes everything by design.

export interface LiveLine {
  speaker: string;
  role: "teammate" | "customer" | "agent";
  text: string;
  at: string;
}

export interface AgentThought {
  at: string;
  text: string;
}

export type AgentActionKind = "investigate" | "share-screen" | "workorder" | "summarize";
export type AgentActionStatus = "pending" | "approved" | "denied" | "done" | "failed";

export interface AgentAction {
  id: string;
  kind: AgentActionKind;
  title: string;
  detail: string;
  status: AgentActionStatus;
  at: string;
  result?: string;
}

interface RoomLive {
  lines: LiveLine[];
  vision?: { at: string; text: string };
  visionLog?: VisionEntry[];
  visionSpokeAt?: number;
  visionSpokeKey?: string;
  summary: string;
  updatedAt: number;
  agent: {
    enabled: boolean;
    thoughts: AgentThought[];
    actions: AgentAction[];
    runId?: string;
    runAnnounced?: boolean;
    proposedInvestigate?: boolean;
  };
}

const rooms = new Map<string, RoomLive>();
const MAX_LINES = 120;
const IDLE_MS = 45 * 60 * 1000;

function get(roomId: string): RoomLive {
  let r = rooms.get(roomId);
  if (!r) {
    r = {
      lines: [], summary: "", updatedAt: Date.now(),
      agent: { enabled: false, thoughts: [], actions: [] },
    };
    rooms.set(roomId, r);
  }
  return r;
}

/** Record a frame Charie really captured, so screen questions get a grounded answer. */
export interface VisionEntry { at: string; text: string; model?: string }

export function recordVision(roomId: string, text: string, model?: string, capturedAt?: string): void {
  const r = get(roomId);
  const entry: VisionEntry = { at: capturedAt && !Number.isNaN(Date.parse(capturedAt)) ? capturedAt : new Date().toISOString(), text: text.slice(0, 600), model };
  // Drop out-of-order frames: a slow vision call for an old screen must
  // never overwrite what she saw more recently (the stale-narration bug).
  const log0 = r.visionLog ?? [];
  const lastEntry = log0[log0.length - 1];
  if (lastEntry && entry.at < lastEntry.at) return;
  if (r.vision && entry.at < r.vision.at) return;
  r.vision = entry;
  // Append-only screen memory: Charie can answer what she saw earlier,
  // not just the last frame. Near-duplicate consecutive frames are skipped.
  const log = (r.visionLog ??= []);
  const last = log[log.length - 1];
  if (!last || last.text.slice(0, 120) !== entry.text.slice(0, 120)) {
    log.push(entry);
    r.visionLog = log.slice(-180);
  }
  r.updatedAt = Date.now();
}

/**
 * Watch mode speaks only problems, and even then at most once per 45s and
 * never the same observation twice - otherwise a persistent error banner
 * makes Charie narrate in a loop.
 */
export function claimVisionSpeech(roomId: string, text: string): boolean {
  const r = get(roomId);
  const now = Date.now();
  const key = text.slice(0, 120);
  if (r.visionSpokeKey === key) return false;
  if (r.visionSpokeAt && now - r.visionSpokeAt < 45000) return false;
  r.visionSpokeKey = key;
  r.visionSpokeAt = now;
  return true;
}

export function getVision(roomId: string): { at: string; text: string } | null {
  return get(roomId).vision ?? null;
}

export function getVisionLog(roomId: string): VisionEntry[] {
  return get(roomId).visionLog ?? [];
}

/** Last screen Charie saw at or before `whenISO` (for "what happened at 10:32?"). */
export function visionAt(roomId: string, whenISO: string): VisionEntry | null {
  const log = get(roomId).visionLog ?? [];
  let best: VisionEntry | null = null;
  for (const e of log) {
    if (e.at <= whenISO) best = e;
    else break;
  }
  return best;
}

export function getAgent(roomId: string) {
  return get(roomId).agent;
}

export function setAgentEnabled(roomId: string, on: boolean) {
  const a = get(roomId).agent;
  a.enabled = on;
  get(roomId).updatedAt = Date.now();
  return a;
}

export function addThought(roomId: string, text: string): AgentThought {
  const a = get(roomId).agent;
  const t: AgentThought = { at: new Date().toISOString(), text: text.slice(0, 400) };
  a.thoughts.push(t);
  a.thoughts = a.thoughts.slice(-60);
  get(roomId).updatedAt = Date.now();
  return t;
}

export function addAction(roomId: string, input: Omit<AgentAction, "id" | "status" | "at">): AgentAction {
  const a = get(roomId).agent;
  const action: AgentAction = {
    ...input,
    id: `act_${Math.random().toString(36).slice(2, 10)}`,
    status: "pending",
    at: new Date().toISOString(),
  };
  a.actions.push(action);
  a.actions = a.actions.slice(-20);
  get(roomId).updatedAt = Date.now();
  return action;
}

export function updateAction(roomId: string, actionId: string, patch: Partial<AgentAction>): AgentAction | null {
  const a = get(roomId).agent;
  const action = a.actions.find((x) => x.id === actionId);
  if (!action) return null;
  Object.assign(action, patch);
  get(roomId).updatedAt = Date.now();
  return action;
}

/** Charie speaks into the transcript (role: agent) so every participant,
 *  including guests, sees the same words the room hears. */
function normSpeech(s: string): string {
  return s.toLowerCase().replace(/\b(the|your|a|an)\b/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function commonPrefixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Would this line repeat something Charie already said in this call?
 * Watch descriptions, question answers, and confirmations arrive via
 * different paths and used to re-say the same screen description two or
 * three times. Exact repeats, near-verbatim repeats, and same-lead
 * re-descriptions (vision lines share their opening) inside the window
 * all count as repeats and never reach the transcript or the voice.
 */
export function isRepeatSpeech(prior: LiveLine[], text: string, windowMs = 180000, now = Date.now()): boolean {
  const n = normSpeech(text);
  if (n.length < 12) return false;
  for (const l of [...prior].reverse()) {
    if (l.role !== "agent") continue;
    if (now - new Date(l.at).getTime() > windowMs) continue;
    const p = normSpeech(l.text);
    if (p === n) return true;
    if (Math.min(p.length, n.length) > 50 && commonPrefixLen(p, n) >= 30) return true;
    if (Math.min(p.length, n.length) > 40 && (p.includes(n) || n.includes(p))) return true;
  }
  return false;
}

export function speak(roomId: string, text: string): LiveLine {
  const r = get(roomId);
  if (isRepeatSpeech(r.lines, text)) {
    addThought(roomId, `Skipped a repeat: "${text.slice(0, 80)}" was already said in this call.`);
    const last = [...r.lines].reverse().find((l) => l.role === "agent");
    if (last) return last;
  }
  return postLine(roomId, { speaker: "Charie", role: "agent", text });
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

export function getLive(roomId: string): { lines: LiveLine[]; notes: string[]; summary: string; visionLog: VisionEntry[] } {
  const r = get(roomId);
  return { lines: r.lines, notes: actionNotes(roomId), summary: r.summary, visionLog: r.visionLog ?? [] };
}

export function setSummary(roomId: string, summary: string): void {
  get(roomId).summary = summary.slice(0, 2000);
  get(roomId).updatedAt = Date.now();
}

export function clearRoom(roomId: string): void {
  rooms.delete(roomId);
}

/**
 * Seed the ephemeral live memory from a room's persisted transcript, notes,
 * and summary (saved when the room last ended). Lets a re-opened room carry
 * its full prior context instead of starting blank. No-op when the room
 * already has live lines, so rejoining a live call never duplicates history.
 */
export function hydrateRoom(
  roomId: string,
  saved?: { transcript?: LiveLine[]; summary?: string; screenLog?: VisionEntry[] },
): void {
  if (!saved?.transcript?.length && !saved?.summary && !saved?.screenLog?.length) return;
  const r = get(roomId);
  if (r.lines.length > 0) return;
  r.lines = (saved.transcript ?? []).slice(-MAX_LINES);
  if (saved.summary) r.summary = saved.summary;
  if (saved.screenLog?.length && !(r.visionLog?.length)) { r.visionLog = saved.screenLog.slice(-180); const last = r.visionLog[r.visionLog.length - 1]; if (last) r.vision = { at: last.at, text: last.text }; }
  r.updatedAt = Date.now();
}
