// Continuous sweep: the Cloud Scheduler heartbeat of Runtime Guardian.
// Every hour the scheduler POSTs here; the sweep re-checks the live
// services (health + auth gate + TLS + headers), stores the record, and the
// portal surfaces streaks and regressions. Real monitoring of real services.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchImpl } from "./baseten.js";

export interface SweepCheck {
  name: string;
  pass: boolean;
  evidence: string;
}

export interface Sweep {
  id: string;
  at: string;
  pass: boolean;
  checks: SweepCheck[];
}

function sweepsFile(root: string): string {
  mkdirSync(root, { recursive: true });
  return join(root, "sweeps.json");
}

export function loadSweeps(root: string): Sweep[] {
  const f = sweepsFile(root);
  if (!existsSync(f)) return [];
  try {
    return JSON.parse(readFileSync(f, "utf8")) as Sweep[];
  } catch {
    return [];
  }
}

/** Consecutive passing sweeps ending at the newest. */
export function passStreak(sweeps: Sweep[]): number {
  let n = 0;
  for (let i = sweeps.length - 1; i >= 0; i--) {
    if (sweeps[i].pass) n++;
    else break;
  }
  return n;
}

export interface SweepTargets {
  portalUrl: string;
  engineUrl: string;
}

export async function runSweep(targets: SweepTargets, root: string, fetchImpl: FetchImpl = fetch): Promise<Sweep> {
  const checks: SweepCheck[] = [];
  const get = (url: string, headers: Record<string, string> = {}) =>
    fetchImpl(url, { headers, redirect: "manual", signal: AbortSignal.timeout(15000) });

  try {
    const r = await get(`${targets.engineUrl.replace(/\/$/, "")}/health`);
    checks.push({ name: "engine health", pass: r.ok, evidence: `GET /health → ${r.status}` });
  } catch (e) {
    checks.push({ name: "engine health", pass: false, evidence: (e as Error).message });
  }
  try {
    const r = await get(`${targets.engineUrl.replace(/\/$/, "")}/runs/nope`);
    checks.push({
      name: "engine auth gate",
      pass: r.status === 401,
      evidence: r.status === 401 ? "unauthenticated read → 401" : `unauthenticated read → ${r.status}`,
    });
  } catch (e) {
    checks.push({ name: "engine auth gate", pass: false, evidence: (e as Error).message });
  }
  try {
    const r = await get(`${targets.portalUrl.replace(/\/$/, "")}/`, {});
    const csp = r.headers.get("content-security-policy") ?? "";
    checks.push({
      name: "portal reachable + csp",
      pass: r.ok && csp.length > 0,
      evidence: `GET / → ${r.status}${csp ? "" : ", no content-security-policy"}`,
    });
  } catch (e) {
    checks.push({ name: "portal reachable + csp", pass: false, evidence: (e as Error).message });
  }
  if (targets.portalUrl.toLowerCase().startsWith("https://")) {
    try {
      const r = await get(targets.portalUrl.replace(/^https:/i, "http:"), {});
      checks.push({
        name: "http upgrades",
        pass: r.status >= 300 && r.status < 400,
        evidence: `http → ${r.status}`,
      });
    } catch (e) {
      checks.push({ name: "http upgrades", pass: true, evidence: `http refused: ${(e as Error).message}` });
    }
  }

  const sweep: Sweep = {
    id: `sw_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    pass: checks.every((c) => c.pass),
    checks,
  };
  const all = [...loadSweeps(root), sweep].slice(-500);
  writeFileSync(sweepsFile(root), JSON.stringify(all, null, 2));
  return sweep;
}
