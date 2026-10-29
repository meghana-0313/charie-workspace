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
