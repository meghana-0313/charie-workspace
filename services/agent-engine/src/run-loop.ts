// GhostQA run loop — CLI entry.
//
//   Investigate:  npm run run -- --target http://localhost:3101
//   Verify fix:   npm run run -- --target http://localhost:3101 --verify --baseline ./reports/<ts>
//
// Output: ./reports/<timestamp>/{trace.json, findings.json, report.md,
//           mcp-packets/*.md, step-*.png, verification.json?}

import { join, resolve } from "node:path";
import { GOAL } from "./explorer.js";
import { executeRun } from "./job.js";
import { runDirName } from "./run-id.js";
import { loadSecrets } from "./secrets.js";

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const target = arg("--target", process.env.TARGET_URL ?? "http://localhost:3101");
const goal = arg("--goal", GOAL);
const verifyMode = process.argv.includes("--verify");
const baselineDir = arg("--baseline");

if (verifyMode && !baselineDir) {
  console.error("Verify mode needs --baseline <reports/<ts> dir>");
  process.exit(1);
}

const { loaded } = await loadSecrets();
if (loaded.length > 0) console.log(`[ghostqa] GCP secrets loaded: ${loaded.join(", ")}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
// The portal pre-assigns the run dir via GHOSTQA_RUN_ID so it can poll status;
// CLI runs without it keep generating their own stamp.
const dirName = runDirName(stamp, verifyMode);
const reportsRoot = resolve(process.cwd(), "reports");
const outDir = join(reportsRoot, dirName);

console.log(`[ghostqa] goal: ${goal}`);
console.log(`[ghostqa] target: ${target} → ${outDir}`);

const { trace, findings, verification } = await executeRun({
  targetUrl: target,
  goal,
  verifyMode,
  baselineRunId: verifyMode ? baselineDir.split(/[\\/]/).pop() : undefined,
  outDir,
  reportsRoot,
});
console.log(`[ghostqa] journey done: goal ${trace.success ? "REACHED ✅" : "NOT reached ❌"} (${trace.actions.length} actions)`);
console.log(`[ghostqa] findings: ${findings.length}`);
for (const f of findings) console.log(`  - [${f.severity}/${f.category}] ${f.title}`);
console.log(`[ghostqa] report: ${join(outDir, "report.md")}`);
if (verification) console.log(`[ghostqa] verification: ${verification.summary}`);
