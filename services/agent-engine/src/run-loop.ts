// GhostQA run loop — CLI entry.
//
//   Investigate:  npm run run -- --target http://localhost:3101
//   Verify fix:   npm run run -- --target http://localhost:3101 --verify --baseline ./reports/<ts>
//
// Output: ./reports/<timestamp>/{trace.json, findings.json, report.md,
//           mcp-packets/*.md, step-*.png, verification.json?}

import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { analyze } from "./analyst.js";
import { GOAL, runJourney } from "./explorer.js";
import { writeReport } from "./reporter.js";
import { verify } from "./verifier.js";

function arg(flag: string, fallback = ""): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const target = arg("--target", process.env.TARGET_URL ?? "http://localhost:3101");
const verifyMode = process.argv.includes("--verify");
const baselineDir = arg("--baseline");

if (verifyMode && !baselineDir) {
  console.error("Verify mode needs --baseline <reports/<ts> dir>");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(process.cwd(), "reports", verifyMode ? `${stamp}-verify` : stamp);
await mkdir(outDir, { recursive: true });

console.log(`[ghostqa] goal: ${GOAL}`);
console.log(`[ghostqa] target: ${target} → ${outDir}`);

const trace = await runJourney(target, outDir);
console.log(`[ghostqa] journey done: goal ${trace.success ? "REACHED ✅" : "NOT reached ❌"} (${trace.actions.length} actions)`);

const findings = await analyze(trace);
console.log(`[ghostqa] findings: ${findings.length}`);
for (const f of findings) console.log(`  - [${f.severity}/${f.category}] ${f.title}`);

await writeReport(outDir, trace, findings);
console.log(`[ghostqa] report: ${join(outDir, "report.md")}`);

if (verifyMode) {
  const result = await verify(resolve(baselineDir), outDir, trace, findings);
  console.log(`[ghostqa] verification: ${result.summary}`);
}
