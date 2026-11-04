// Night Shift: autonomous overnight execution of approved Work Orders.
// The scheduler (or the portal Run now button) triggers a shift; each step
// executes for real and records proofs; the shift ends with a morning
// digest. Heavy browser re-verifications claim the same single-run lock as
// portal runs so Night Shift never fights a human-driven run.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { executeRun } from "./job.js";
import { runPentest, type PentestReport, type TlsConnect } from "./pentest.js";
import { chat, modelId } from "./meta-client.js";
import { secret } from "./secrets.js";
import type { FetchImpl } from "./baseten.js";
import {
  getWorkOrder, loadWorkOrders, updateWorkOrder,
  type WorkOrder, type WorkOrderProof, type WorkOrderStep,
} from "./workorders.js";

export interface ShiftOrderResult {
  id: string;
  title: string;
  status: WorkOrder["status"];
  proofs: WorkOrderProof[];
}

export interface NightShiftReport {
  id: string;
  at: string;
  orders: ShiftOrderResult[];
  pentest: PentestReport | null;
  digest: string;
  durationMs: number;
}

export interface ShiftOpts {
  dataRoot: string;
  reportsRoot: string;
  portalUrl: string;
  engineUrl: string;
  engineToken?: string;
  orderIds?: string[]; // default: all approved/scheduled
  claimHeavy: () => boolean; // single-run lock: portal runs and shifts share it
  releaseHeavy: () => void;
  fetchImpl?: FetchImpl;
  tlsImpl?: TlsConnect | null; // default: real TLS handshake
}

function proof(step: string, ok: boolean, detail: string, artifact?: string): WorkOrderProof {
  return { at: new Date().toISOString(), step, ok, detail, artifact };
}

async function execVerifyFix(root: string, step: WorkOrderStep, opts: ShiftOpts): Promise<WorkOrderProof> {
  if (!step.targetUrl || !step.baselineRunId) {
    return proof(step.label, false, "verify-fix needs targetUrl + baselineRunId; order left for human review");
  }
  if (!existsSync(join(opts.reportsRoot, step.baselineRunId, "findings.json"))) {
    return proof(step.label, false, `baseline run ${step.baselineRunId} not found`);
  }
  if (!opts.claimHeavy()) return proof(step.label, false, "engine busy with another run; will retry next shift");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = join(opts.reportsRoot, `${stamp}-nightshift`);
    await executeRun({
      targetUrl: step.targetUrl,
      goal: step.goal ?? "Re-verify the reported issue is fixed",
      verifyMode: true,
      baselineRunId: step.baselineRunId,
      outDir,
      reportsRoot: opts.reportsRoot,
    });
    const v = JSON.parse(readFileSync(join(outDir, "verification.json"), "utf8")) as { fixed?: boolean; detail?: string };
    return proof(
      step.label,
      v.fixed === true,
      v.fixed === true
        ? `Autonomous re-verification confirms the fix (${step.baselineRunId} → fixed)`
        : `Re-verification still reproduces the issue: ${v.detail ?? "see verification.json"}`,
      `${stamp}-nightshift/verification.json`,
    );
  } catch (e) {
    return proof(step.label, false, `re-verification crashed: ${(e as Error).message}`);
  } finally {
    opts.releaseHeavy();
  }
}

async function execReAnalyze(step: WorkOrderStep, opts: ShiftOpts): Promise<WorkOrderProof> {
  const report = await runPentest(
    { portalUrl: opts.portalUrl, engineUrl: opts.engineUrl, engineToken: opts.engineToken },
    opts.fetchImpl ?? fetch,
    opts.tlsImpl,
  );
  const ok = report.grade === "A" || report.grade === "B";
  return proof(
    step.label,
    ok,
    `Security re-scan grade ${report.grade}: ${report.passed}/${report.checks.length} checks pass` +
      (ok ? "" : `; worst: ${report.checks.find((c) => !c.pass)?.name ?? "see report"}`),
  );
}

function execEvidencePack(root: string, wo: WorkOrder, proofs: WorkOrderProof[]): WorkOrderProof {
  const md = [
    `# Evidence pack - ${wo.id}`,
    ``,
    `Order: ${wo.title} (source: ${wo.source} ${wo.sourceRef})`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    ...proofs.map((p) => `- [${p.ok ? "PASS" : "FAIL"}] ${p.step}: ${p.detail}${p.artifact ? ` (${p.artifact})` : ""}`),
  ].join("\n");
  const name = `evidence-${wo.id}.md`;
  writeFileSync(join(root, name), md);
  return proof("evidence-pack", true, `${proofs.filter((p) => p.ok).length}/${proofs.length} proofs collected`, name);
}

async function execDocsNote(root: string, wo: WorkOrder, proofs: WorkOrderProof[], fetchImpl: FetchImpl): Promise<WorkOrderProof> {
  const brief = proofs.map((p) => `- ${p.step}: ${p.ok ? "ok" : "FAILED"} - ${p.detail}`).join("\n");
  let note = `Remediation note for ${wo.title}:\n${brief}\nRecommendation: review failed proofs before closing.`;
  if (secret("META_API_KEY")) {
    try {
      note = await chat(
        [
          { role: "system", content: "Write a short remediation note for engineers: what was verified overnight, what still needs a human. Plain text, under 200 words." },
          { role: "user", content: `Work order: ${wo.title}\nOvernight proofs:\n${brief}` },
        ],
        { model: modelId("spark"), maxTokens: 600, fetchImpl },
      );
    } catch {
      /* heuristic note stands */
    }
  }
  const name = `note-${wo.id}.md`;
  writeFileSync(join(root, name), `# Night Shift note - ${wo.title}\n\n${note}\n`);
  return proof("docs-note", true, "remediation note written", name);
}

/** Execute one order through running → verifying → done/failed. */
async function executeOrder(root: string, wo: WorkOrder, opts: ShiftOpts): Promise<ShiftOrderResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  updateWorkOrder(root, wo.id, { status: "running" });
  const proofs: WorkOrderProof[] = [];
  try {
    for (const step of wo.plan) {
      if (step.kind === "verify-fix") proofs.push(await execVerifyFix(root, step, opts));
      else if (step.kind === "re-analyze") proofs.push(await execReAnalyze(step, opts));
      else if (step.kind === "evidence-pack") proofs.push(execEvidencePack(root, wo, proofs));
      else proofs.push(await execDocsNote(root, wo, proofs, fetchImpl));
    }
  } catch (e) {
    proofs.push(proof("shift", false, `executor crashed: ${(e as Error).message}`));
  }
  updateWorkOrder(root, wo.id, { status: "verifying", proofs: [...wo.proofs, ...proofs] });
  const failed = proofs.filter((p) => !p.ok);
  const status = failed.length === 0 ? "done" : "failed";
  updateWorkOrder(root, wo.id, { status });
  return { id: wo.id, title: wo.title, status, proofs };
}

export function digestMarkdown(report: Omit<NightShiftReport, "digest">): string {
  const lines = [
    `# Night Shift digest - ${report.at.slice(0, 10)}`,
    ``,
    `Orders executed: ${report.orders.length} · done: ${report.orders.filter((o) => o.status === "done").length} · attention: ${report.orders.filter((o) => o.status !== "done").length}`,
    `Shift duration: ${Math.round(report.durationMs / 1000)}s`,
    ``,
  ];
  for (const o of report.orders) {
    lines.push(`## ${o.status === "done" ? "DONE" : "NEEDS HUMAN"} ${o.title}`, ``);
    for (const p of o.proofs) lines.push(`- [${p.ok ? "PASS" : "FAIL"}] ${p.step}: ${p.detail}`);
    lines.push(``);
  }
  if (report.pentest) {
    lines.push(
      `## Nightly security re-scan: grade ${report.pentest.grade}`,
      ``,
      ...report.pentest.checks.map((c) => `- [${c.pass ? "PASS" : "FAIL"}] ${c.name}: ${c.evidence}`),
      ``,
    );
  }
  return lines.join("\n");
}

function digestsFile(root: string): string {
  mkdirSync(root, { recursive: true });
  return join(root, "digests.json");
}

export function loadDigests(root: string): NightShiftReport[] {
  const f = digestsFile(root);
  if (!existsSync(f)) return [];
  try {
    return JSON.parse(readFileSync(f, "utf8")) as NightShiftReport[];
  } catch {
    return [];
  }
}

/** Run a full shift: eligible orders + nightly security re-scan + digest. */
export async function runNightShift(opts: ShiftOpts): Promise<NightShiftReport> {
  const started = Date.now();
  const root = opts.dataRoot;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const eligible = loadWorkOrders(root).filter((w) =>
    opts.orderIds ? opts.orderIds.includes(w.id) : w.status === "approved" || w.status === "scheduled",
  );
  if (opts.orderIds) {
    for (const w of eligible) {
      if (w.status !== "approved" && w.status !== "scheduled") {
        throw new Error(`order ${w.id} is ${w.status}, only approved/scheduled orders run`);
      }
    }
  }
  const results: ShiftOrderResult[] = [];
  for (const wo of eligible) {
    const fresh = getWorkOrder(root, wo.id);
    if (fresh && (fresh.status === "approved" || fresh.status === "scheduled")) {
      results.push(await executeOrder(root, fresh, opts));
    }
  }
  let pentest: PentestReport | null = null;
  try {
    pentest = await runPentest(
      { portalUrl: opts.portalUrl, engineUrl: opts.engineUrl, engineToken: opts.engineToken },
      fetchImpl,
      opts.tlsImpl,
    );
  } catch (e) {
    console.warn(`[nightshift] nightly re-scan skipped: ${(e as Error).message}`);
  }
  const partial = {
    id: `shift_${new Date().toISOString().slice(0, 10)}_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    orders: results,
    pentest,
    durationMs: Date.now() - started,
  };
  const report: NightShiftReport = { ...partial, digest: digestMarkdown(partial) };
  const all = [...loadDigests(root), report].slice(-30);
  writeFileSync(digestsFile(root), JSON.stringify(all, null, 2));
  return report;
}
