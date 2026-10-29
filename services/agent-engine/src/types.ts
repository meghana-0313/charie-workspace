// Shared types for the GhostQA loop. Mirrors docs/ARCHITECTURE.md.

export type Category = "functional" | "usability" | "accessibility" | "security" | "change-impact";
export type Severity = "blocker" | "major" | "minor";
export type Confidence = "high" | "medium" | "low";
export type FindingStatus = "open" | "fix_proposed" | "verified" | "regressed";

export interface Finding {
  id: string; // stable across re-runs: category + slug
  category: Category;
  severity: Severity;
  title: string;
  goal: string;
  reproSteps: string[];
  evidence: { screenshots: string[]; trace: string; logs: string[] };
  suspectedCause: string;
  confidence: Confidence;
  suggestedFix: string;
  regressionCheck: string;
  status: FindingStatus;
  analysisSource: "heuristic" | "muse-spark"; // honest label for the demo
}

export interface TraceAction {
  t: number; // ms since run start
  action: string;
  detail?: string;
  screenshot?: string;
  ok: boolean;
}

export interface TraceEvent {
  t: number;
  kind: "console-error" | "request-failed" | "response-error" | "navigation" | "signal";
  detail: string;
}

export interface JourneyTrace {
  goal: string;
  targetUrl: string;
  build: string;
  startedAt: string;
  finishedAt: string;
  success: boolean; // reached the goal end state (order confirmation)
  actions: TraceAction[];
  events: TraceEvent[];
  confusionSignals: ConfusionSignal[];
}

export interface ConfusionSignal {
  step: string;
  signal: "backtrack" | "reclick" | "ambiguous-controls" | "dwell" | "silent-noop" | "keyboard-trap";
  detail: string;
}

export interface VerificationResult {
  baselineRun: string;
  verifyRun: string;
  targetUrl: string;
  results: Array<{
    findingId: string;
    title: string;
    verdict: "fixed" | "still-open" | "new";
  }>;
  goalReached: boolean;
  summary: string;
}
