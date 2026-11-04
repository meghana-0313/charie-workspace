// Verifier: diffs a verify-run's findings against the baseline run's findings
// by stable finding ID. A finding counts as fixed only if it is GONE from the
// verify run. New IDs in the verify run are reported as (possible) regressions.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Finding, JourneyTrace, VerificationResult } from "./types.js";

export async function verify(
  baselineDir: string,
  verifyDir: string,
  verifyTrace: JourneyTrace,
  verifyFindings: Finding[],
): Promise<VerificationResult> {
  const baseline: Finding[] = JSON.parse(await readFile(join(baselineDir, "findings.json"), "utf8"));
  const baseIds = new Set(baseline.map((f) => f.id));
  const verifyIds = new Map(verifyFindings.map((f) => [f.id, f]));

  const results: VerificationResult["results"] = [];
  for (const b of baseline) {
    results.push({
      findingId: b.id,
      title: b.title,
      verdict: verifyIds.has(b.id) ? "still-open" : "fixed",
    });
  }
  for (const [id, f] of verifyIds) {
    if (!baseIds.has(id)) results.push({ findingId: id, title: f.title, verdict: "new" });
  }

  const fixed = results.filter((r) => r.verdict === "fixed").length;
  const open = results.filter((r) => r.verdict === "still-open").length;
  const fresh = results.filter((r) => r.verdict === "new").length;
  const result: VerificationResult = {
    baselineRun: baselineDir,
    verifyRun: verifyDir,
    targetUrl: verifyTrace.targetUrl,
    results,
    goalReached: verifyTrace.success,
    summary: `${fixed}/${baseline.length} baseline findings fixed; ${open} still open; ${fresh} new; goal ${
      verifyTrace.success ? "reached ✅" : "NOT reached ❌"
    }.`,
  };
  await writeFile(join(verifyDir, "verification.json"), JSON.stringify(result, null, 2));
  return result;
}
