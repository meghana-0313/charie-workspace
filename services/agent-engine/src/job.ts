// One engine run end to end: journey → analyze → report → (verify) → upload.
// Shared by the CLI (run-loop.ts) and the HTTP service (server.ts) so both
// always produce identical report dirs.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { analyze } from "./analyst.js";
import { runJourney } from "./explorer.js";
import { writeReport } from "./reporter.js";
import { ensureBaselineLocal } from "./storage.js";
import { verify } from "./verifier.js";
import type { Finding, JourneyTrace, VerificationResult } from "./types.js";

export interface RunRequest {
  targetUrl: string;
  goal: string;
  verifyMode?: boolean;
  /** Report dir name of the baseline run (verify mode only). */
  baselineRunId?: string;
  /** Absolute report dir for THIS run (created here). */
  outDir: string;
  /** Absolute reports root (baselines live here). */
  reportsRoot: string;
}

export interface RunOutcome {
  trace: JourneyTrace;
  findings: Finding[];
  verification: VerificationResult | null;
}

export async function executeRun(req: RunRequest): Promise<RunOutcome> {
  await mkdir(req.outDir, { recursive: true });
  const trace = await runJourney(req.targetUrl, req.outDir, req.goal);
  const findings = await analyze(trace);
  await writeReport(req.outDir, trace, findings);
  let verification: VerificationResult | null = null;
  if (req.verifyMode) {
    if (!req.baselineRunId) throw new Error("verify mode needs baselineRunId");
    await ensureBaselineLocal(req.reportsRoot, req.baselineRunId);
    verification = await verify(join(req.reportsRoot, req.baselineRunId), req.outDir, trace, findings);
  }
  const { uploadRun } = await import("./storage.js");
  await uploadRun(req.outDir);
  return { trace, findings, verification };
}
