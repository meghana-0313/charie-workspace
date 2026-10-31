// Reporter: findings.json + human-readable report.md + per-finding MCP packets
// (paste-ready instruction blocks for Muse Code / any coding agent).

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { briefFor } from "./redesign.js";
import type { Finding, JourneyTrace } from "./types.js";

export function mcpPacket(f: Finding, trace: JourneyTrace): string {
  return [
    `# Fix instruction - ${f.id} [${f.severity}/${f.category}]`,
    ``,
    `## Problem`,
    f.title,
    ``,
    `## Reproduce`,
    ...f.reproSteps.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `## Suspected cause (confidence: ${f.confidence}, source: ${f.analysisSource})`,
    f.suspectedCause,
    ``,
    `## Required fix`,
    f.suggestedFix,
    ``,
    `## Accept when (verifier will check this)`,
    f.regressionCheck,
    ``,
    `## Context`,
    `- Goal: ${trace.goal}`,
    `- Target: ${trace.targetUrl} (build: ${trace.build})`,
    `- Evidence: ${f.evidence.screenshots.join(", ") || "none"} + trace.json`,
  ].join("\n");
}

export async function writeReport(outDir: string, trace: JourneyTrace, findings: Finding[]): Promise<void> {
  await mkdir(join(outDir, "mcp-packets"), { recursive: true });
  await writeFile(join(outDir, "findings.json"), JSON.stringify(findings, null, 2));

  for (const f of findings) {
    await writeFile(join(outDir, "mcp-packets", `${f.id}.md`), mcpPacket(f, trace));
  }

  const spark = findings.filter((f) => f.analysisSource === "muse-spark").length;
  const lines = [
    `# GhostQA run report`,
    ``,
    `- **Goal:** ${trace.goal}`,
    `- **Target:** ${trace.targetUrl} (build: \`${trace.build}\`)`,
    `- **Ran:** ${trace.startedAt} → ${trace.finishedAt}`,
    `- **Goal reached:** ${trace.success ? "YES ✅" : "NO ❌"}`,
    `- **Analysis:** ${spark}/${findings.length} findings enriched by Muse Spark${spark === 0 ? " (heuristic mode - set META_API_KEY to upgrade)" : ""}`,
    ``,
    `> Usability results below are **AI simulation (heuristic v0)**, not human data.`,
    `> Human validation is a separate, optional step.`,
    ``,
    `## Findings (${findings.length})`,
    ``,
  ];
  for (const [i, f] of findings.entries()) {
    lines.push(
      `### ${i + 1}. ${f.title} - \`${f.id}\``,
      ``,
      `- Category: ${f.category} · Severity: **${f.severity}** · Confidence: ${f.confidence} · Source: ${f.analysisSource}`,
      `- Suspected cause: ${f.suspectedCause}`,
      `- Suggested fix: ${f.suggestedFix}`,
      `- Regression check: ${f.regressionCheck}`,
      `- Repro:`,
      ...f.reproSteps.map((s, j) => `  ${j + 1}. ${s}`),
      `- Evidence: ${[...f.evidence.screenshots, f.evidence.trace].join(", ")}`,
      `- MCP packet: \`mcp-packets/${f.id}.md\``,
      ``,
    );
  }
  const briefs = findings.map(briefFor).filter((b) => b !== null);
  if (briefs.length > 0) {
    await writeFile(join(outDir, "briefs.json"), JSON.stringify(briefs, null, 2));
    lines.push(`## Redesign briefs (${briefs.length})`, ``, `> Written briefs (heuristic v0). Muse Image visual alternatives attach here in M2.`, ``);
    for (const b of briefs) {
      lines.push(`### ${b.findingId}`, ``);
      for (const d of b.directions) lines.push(`- **${d.name}:** ${d.change}`, `  Trade-off: ${d.tradeoff}`);
      lines.push(`- Component plan: ${b.componentPlan}`, ``);
    }
  }
  lines.push(
    `## Action trace (${trace.actions.length} actions, ${trace.events.length} events)`,
    ``,
    ...trace.actions.map(
      (a) => `- [+${a.t}ms] ${a.ok ? "✅" : "❌"} ${a.action}${a.detail ? ` - ${a.detail}` : ""}${a.screenshot ? ` (${a.screenshot})` : ""}`,
    ),
    ``,
    `## Confusion signals (${trace.confusionSignals.length})`,
    ``,
    ...(trace.confusionSignals.length === 0
      ? ["None - the naive-user pass completed without hesitation signals."]
      : trace.confusionSignals.map((s) => `- [${s.signal}] ${s.step}: ${s.detail}`)),
    ``,
  );
  await writeFile(join(outDir, "report.md"), lines.join("\n"));
}
