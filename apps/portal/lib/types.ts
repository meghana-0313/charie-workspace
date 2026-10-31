// Portal domain types. Mirrors docs/FIRESTORE_SCHEMA.md so the JSON-file store
// swaps for Firestore without touching components.

export type TicketStatus = "new" | "investigating" | "in-room" | "fix-proposed" | "verified" | "closed";

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  goal: string;
  targetUrl: string;
  voiceNotePath?: string; // uploaded audio; transcription wires up in M4
  status: TicketStatus;
  roomId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomMessage {
  id: string;
  authorType: "human" | "agent";
  authorName: string;
  body: string;
  findingIds: string[];
  createdAt: string;
}

export interface Approval {
  id: string;
  findingIds: string[];
  instruction: string;
  approvedBy: string;
  status: "approved" | "sent-to-agent";
  createdAt: string;
}

export interface Room {
  id: string;
  ticketId: string;
  title: string;
  status: "open" | "resolved";
  runIds: string[];
  createdAt: string;
}

export interface PortalRun {
  id: string; // = engine report dir name
  ticketId: string;
  roomId: string;
  kind: "investigate" | "verify";
  targetUrl: string;
  status: "running" | "done" | "failed";
  baselineRunId?: string;
  createdAt: string;
}

// Guardian types. Mirror the engine shapes; the portal stays decoupled.
export interface GuardEventView {
  id: string;
  ts: string;
  kind: "auth" | "api" | "traffic" | "infra";
  actor?: string;
  ip?: string;
  endpoint?: string;
  outcome?: "success" | "failure" | "deny" | "allow";
  country?: string;
  bytes?: number;
  records?: number;
}

export interface IncidentSignal {
  type: string;
  severity: string;
  title: string;
  evidence: string[];
  actors: string[];
  ips: string[];
}

export interface IncidentAction {
  id: string;
  action: "block_ip" | "revoke_sessions" | "rate_limit";
  target: string;
  status: string;
  detail: string;
  at: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: "blocker" | "major" | "minor";
  status: "open" | "contained" | "resolved";
  signals: IncidentSignal[];
  investigation: {
    verdict: string;
    severity: string;
    summary: string;
    timeline: string[];
    plan: string[];
    disagreement: string | null;
    glimmerFiltered: number;
  } | null;
  mode: "investigated" | "signals-only";
  baselineSuspicious: number;
  actions: IncidentAction[];
  simulated: true;
  createdAt: string;
  updatedAt: string;
}

// Subset of the engine Finding type, re-declared to keep the portal decoupled.
export interface FindingView {
  id: string;
  category: string;
  severity: string;
  title: string;
  reproSteps: string[];
  evidence: { screenshots: string[]; trace: string; logs: string[] };
  suspectedCause: string;
  confidence: string;
  suggestedFix: string;
  regressionCheck: string;
  analysisSource: string;
}
