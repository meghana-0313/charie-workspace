// Work Orders: approved, scheduled units of autonomous remediation work.
// A work order is born from a Guardian incident, a customer signal cluster,
// or a pen-test finding. Humans approve; Night Shift executes overnight;
// proofs land back here for review. State persists to engine-data so the
// scheduler path and the portal path share one record.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type WorkOrderStatus =
  | "proposed" | "approved" | "scheduled" | "running" | "verifying" | "done" | "failed" | "rolledback";

export type RiskTier = "low" | "medium" | "high";

export interface WorkOrderStep {
  kind: "verify-fix" | "re-analyze" | "evidence-pack" | "docs-note";
  label: string;
  ref: string; // ticket id, incident id, or finding id
  detail?: string;
  targetUrl?: string; // verify-fix: app URL to re-drive
  baselineRunId?: string; // verify-fix: baseline run to compare against
  goal?: string; // verify-fix: user task to re-verify
}

export interface WorkOrderProof {
  at: string;
  step: string;
  ok: boolean;
  detail: string;
  artifact?: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  source: "guardian" | "signals" | "pentest" | "manual";
  sourceRef: string;
  status: WorkOrderStatus;
  risk: RiskTier;
  plan: WorkOrderStep[];
  approvals: Array<{ by: string; at: string }>;
  proofs: WorkOrderProof[];
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  proposed: ["approved", "failed"],
  approved: ["scheduled", "running", "failed"],
  scheduled: ["running", "failed"],
  running: ["verifying", "failed"],
  verifying: ["done", "failed", "rolledback"],
  done: [],
  failed: ["proposed"],
  rolledback: ["proposed"],
};

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Risk from plan shape: verify-only work is low, anything broader escalates. */
export function riskOf(plan: WorkOrderStep[]): RiskTier {
  if (plan.length === 0) return "high";
  const kinds = new Set(plan.map((p) => p.kind));
  if (kinds.size === 1 && (kinds.has("verify-fix") || kinds.has("re-analyze"))) return "low";
  if (kinds.has("docs-note") && kinds.size <= 2) return "medium";
  return "medium";
}

function dataFile(root: string): string {
  mkdirSync(root, { recursive: true });
  return join(root, "workorders.json");
}

export function loadWorkOrders(root: string): WorkOrder[] {
  const f = dataFile(root);
  if (!existsSync(f)) return [];
  try {
    return JSON.parse(readFileSync(f, "utf8")) as WorkOrder[];
  } catch {
    return [];
  }
}

function saveAll(root: string, all: WorkOrder[]): void {
  writeFileSync(dataFile(root), JSON.stringify(all, null, 2));
}

export function createWorkOrder(
  root: string,
  input: { title: string; source: WorkOrder["source"]; sourceRef: string; plan: WorkOrderStep[] },
): WorkOrder {
  const all = loadWorkOrders(root);
  const now = new Date().toISOString();
  const wo: WorkOrder = {
    id: `wo_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    title: input.title,
    source: input.source,
    sourceRef: input.sourceRef,
    status: "proposed",
    risk: riskOf(input.plan),
    plan: input.plan,
    approvals: [],
    proofs: [],
    createdAt: now,
    updatedAt: now,
  };
  all.push(wo);
  saveAll(root, all);
  return wo;
}

export function getWorkOrder(root: string, id: string): WorkOrder | null {
  return loadWorkOrders(root).find((w) => w.id === id) ?? null;
}

export function updateWorkOrder(root: string, id: string, patch: Partial<WorkOrder>): WorkOrder | null {
  const all = loadWorkOrders(root);
  const i = all.findIndex((w) => w.id === id);
  if (i < 0) return null;
  if (patch.status && patch.status !== all[i].status && !canTransition(all[i].status, patch.status)) {
    throw new Error(`illegal transition ${all[i].status} -> ${patch.status}`);
  }
  all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  saveAll(root, all);
  return all[i];
}

export function approveWorkOrder(root: string, id: string, by: string): WorkOrder | null {
  const wo = getWorkOrder(root, id);
  if (!wo) return null;
  if (wo.status !== "proposed") throw new Error(`only proposed orders can be approved (is ${wo.status})`);
  const all = loadWorkOrders(root);
  const i = all.findIndex((w) => w.id === id);
  all[i] = {
    ...all[i],
    status: "approved",
    approvals: [...all[i].approvals, { by, at: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  };
  saveAll(root, all);
  return all[i];
}
