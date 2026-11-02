// Portal domain types. Mirrors docs/FIRESTORE_SCHEMA.md so the JSON-file store
// swaps for Firestore without touching components.
// uid = Firebase user id that owns the record. Records without uid predate
// accounts (or were made by local owner mode) and stay visible to the team.

export type TicketStatus = "new" | "investigating" | "in-room" | "fix-proposed" | "verified" | "closed";

export interface Ticket {
  id: string;
  uid?: string;
  subject: string;
  body: string;
  goal: string;
  targetUrl: string;
  voiceNotePath?: string; // uploaded audio; transcription wires up in M4
  sourceRepo?: string; // owner/repo when auto-filed from a connected repo build
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
  uid?: string;
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
  uid?: string; // ingesting account (API key owner or session user), stamped server side
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
  uid?: string; // account that ran the analysis, stamped server side
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
  voiceBrief?: string;
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
  grounding?: Array<{
    screenshot: string;
    boxes: Array<{ x: number; y: number; width: number; height: number; label: string }>;
  }>;
}

export interface BriefView {
  findingId: string;
  directions: Array<{ name: string; change: string; tradeoff: string }>;
  componentPlan: string;
  images: string[];
}

// Guardian suite views. Mirror the engine shapes; the portal stays decoupled.
export interface WorkOrderStepView {
  kind: "verify-fix" | "re-analyze" | "evidence-pack" | "docs-note";
  label: string;
  ref: string;
  detail?: string;
  targetUrl?: string;
  baselineRunId?: string;
  goal?: string;
}

export interface WorkOrderView {
  id: string;
  title: string;
  source: string;
  sourceRef: string;
  status: string;
  risk: string;
  plan: WorkOrderStepView[];
  approvals: Array<{ by: string; at: string }>;
  proofs: Array<{ at: string; step: string; ok: boolean; detail: string; artifact?: string }>;
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SignalClusterView {
  id: string;
  theme: string;
  size: number;
  angryShare: number;
  sampleIds: string[];
  samples: string[];
}

export interface SweepView {
  id: string;
  at: string;
  pass: boolean;
  checks: Array<{ name: string; pass: boolean; evidence: string }>;
}

export interface PentestView {
  id: string;
  at: string;
  targets: string[];
  checks: Array<{ id: string; name: string; severity: string; pass: boolean; evidence: string; owasp?: string }>;
  passed: number;
  failed: number;
  grade: string;
  recon?: { server: string; poweredBy: string; tech: string[]; endpoints: string[] };
}

export interface DigestView {
  id: string;
  at: string;
  orders: Array<{ id: string; title: string; status: string; proofs: WorkOrderView["proofs"] }>;
  pentest: PentestView | null;
  digest: string;
  durationMs: number;
}

export interface LogWatchView {
  id: string;
  at: string;
  projectId: string;
  windowMinutes: number;
  configured: boolean;
  total: number;
  groups: Array<{ signature: string; service: string; count: number; sample: string; firstSeen: string; lastSeen: string }>;
}

export interface ZoomView {
  configured: boolean;
  provider: string;
  bots: Array<{ id: string; meetingUrl: string; status: string }>;
  setup: string[];
}

export interface A11yView {
  id: string;
  at: string;
  targetUrl: string;
  checks: Array<{ id: string; name: string; severity: string; pass: boolean; evidence: string; owasp?: string }>;
  passed: number;
  failed: number;
  grade: string;
  recon?: { server: string; poweredBy: string; tech: string[]; endpoints: string[] };
}

export interface FirstRunView {
  id: string;
  at: string;
  targetUrl: string;
  steps: Array<{ id: string; name: string; pass: boolean; evidence: string }>;
  passed: number;
  failed: number;
  score: number;
}

export interface MeetRoom {
  id: string;
  uid?: string;
  title: string;
  createdBy: string;
  liveNotes?: boolean; // opt-in: Charie joins with live transcription + notes
  seq: number; // last signal sequence number
  createdAt: string;
  updatedAt: string;
}

/** A guest consent check-in, recorded before call signaling is allowed. */
export interface MeetCheckin {
  roomId: string;
  name: string;
  ticketId: string;
  transcribe?: boolean; // guest opted into live transcription at check-in
  at: string;
}

export interface TeamSeat {
  id: string;
  email: string; // Google account; invites match on this
  name?: string;
  role: "admin" | "member";
  owner?: boolean; // first seat bootstraps as owner
  uid?: string; // linked Firebase uid after first login
  createdAt: string;
  lastLoginAt?: string;
}

export interface ApiKey {
  id: string;
  uid?: string;
  prefix: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
}

export type MeetSignalKind = "join" | "leave" | "offer" | "answer" | "candidate";

export interface MeetSignal {
  seq: number;
  roomId: string;
  from: string;
  to: string; // peer id or "*" for broadcast
  kind: MeetSignalKind;
  payload: string; // JSON: SDP or ICE candidate, "" for join/leave
  createdAt: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
}

export interface RepoConnection {
  id: string;
  uid?: string;
  owner: string;
  repo: string;
  branch: string;
  subdir: string; // build context inside the repo, "" = root
  startCommand: string; // used by generated Dockerfiles
  visibility: "public" | "private";
  hasToken: boolean;
  token?: string; // PAT for private repos (v1: same trust boundary as Firestore data)
  webhookSecret?: string; // HMAC secret for push webhooks
  autoTestOnPush?: boolean; // default true: push to branch rebuilds + retests
  status: "connected" | "building" | "live" | "failed";
  lastSha?: string;
  appUrl?: string;
  ticketId?: string;
  createdAt: string;
  updatedAt: string;
}

export type RepoBuildStatus = "queued" | "working" | "success" | "failure" | "deployed" | "error";

export interface RepoBuild {
  id: string;
  repoId: string;
  sha: string;
  cloudBuildId: string;
  strategy: "dockerfile" | "node" | "python";
  status: RepoBuildStatus;
  appUrl?: string;
  ticketId?: string;
  detail?: string;
  createdAt: string;
  updatedAt: string;
}

// Autopilot: recurring autonomous runs. /api/cron/tick executes due ones.
export type ScheduleKind = "sweep" | "pentest" | "nightshift" | "logwatch";
export type SchedulePreset = "hourly" | "daily" | "weekly";

export interface Schedule {
  id: string;
  uid?: string;
  kind: ScheduleKind;
  preset: SchedulePreset;
  target?: string; // pentest target URL
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: string;
  createdAt: string;
  updatedAt: string;
}

// GitHub OAuth token per user (one-click connect). Same trust boundary as repo PATs.
export interface GithubToken {
  uid: string;
  token: string;
  login?: string;
  createdAt: string;
  updatedAt: string;
}


// Chat with Charie: persistent threads per account.
export interface ChatAttachment {
  name: string;
  url: string; // /api/uploads/<file>, session gated readback
  path: string; // uploads/<file> blob key
  kind: "image" | "video" | "audio" | "file";
}

export interface ChatMessageView {
  role: "user" | "assistant";
  text: string;
  model?: string; // serving model id or "heuristic"
  actions?: string[]; // tool calls made, e.g. "ticket_status tkt_x"
  attachments?: ChatAttachment[];
  at: string;
}

export interface ChatThread {
  id: string;
  uid?: string;
  title: string;
  messages: ChatMessageView[];
  createdAt: string;
  updatedAt: string;
}

// Marketplace connectors: external systems Charie syncs with.
export type ConnectorKind = "github" | "jira" | "webhook-in";

export interface Connector {
  id: string;
  uid?: string;
  kind: ConnectorKind;
  name: string;
  status: "connected" | "error";
  detail?: string;
  config: {
    domain?: string; // jira host
    email?: string; // jira login
    token?: string; // jira api token (server only, never serialized to clients)
  };
  lastSyncAt?: string;
  lastSyncStatus?: string;
  createdAt: string;
  updatedAt: string;
}

// Sync rules: what to pull, where to test it, how often.
export interface SyncRule {
  id: string;
  uid?: string;
  connectorId: string;
  kind: "jira-pull";
  jql?: string; // empty = whole project
  project?: string;
  targetUrl: string; // app under test for auto investigations
  preset: SchedulePreset;
  enabled: boolean;
  importedKeys?: string[];
  doneTransitionId?: string; // jira transition applied after verify
  lastRunAt?: string;
  lastStatus?: string;
  createdAt: string;
  updatedAt: string;
}

// Context docs: workspace notes that ground chat answers.
export interface ContextDoc {
  id: string;
  uid?: string;
  title: string;
  source: "note" | "url";
  body?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}
