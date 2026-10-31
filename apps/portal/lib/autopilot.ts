// Autopilot: recurring autonomous runs. Schedules live in the store;
// /api/cron/tick (Cloud Scheduler in prod, the Autopilot page locally)
// executes whatever is due and advances unfinished repo builds.

import { store } from "./store";
import { runLogWatch, runNightShift, runPentest, runSweep } from "./guardian";
import { pushToAll } from "./push";
import { advanceStuckBuilds } from "./repos";
import type { Schedule, SchedulePreset } from "./types";

const WINDOW_MS: Record<SchedulePreset, number> = {
  hourly: 3600 * 1000,
  daily: 24 * 3600 * 1000,
  weekly: 7 * 24 * 3600 * 1000,
};

export function scheduleDue(s: Schedule, at = Date.now()): boolean {
  if (!s.enabled) return false;
  const last = s.lastRunAt ? Date.parse(s.lastRunAt) : Date.parse(s.createdAt);
  if (Number.isNaN(last)) return true;
  return at - last >= WINDOW_MS[s.preset];
}

/** Execute one schedule. Returns a short human status, never throws. */
export async function executeSchedule(s: Schedule): Promise<string> {
  try {
    if (s.kind === "sweep") {
      const r = await runSweep();
      if (!r) return "engine unreachable";
      if (!r.pass) {
        await pushToAll(
          "Guardian sweep failing",
          r.checks.filter((c) => !c.pass).map((c) => c.name).join(", "),
          "/guardian",
        ).catch(() => {});
      }
      return r.pass ? "pass" : "failing";
    }
    if (s.kind === "pentest") {
      const r = await runPentest();
      if (!r) return "engine unreachable";
      if (r.grade === "F" || r.grade === "D") {
        await pushToAll(`Security re-scan: grade ${r.grade}`, `${r.failed} checks failing. Open the report.`, "/guardian/security").catch(() => {});
      }
      return `grade ${r.grade}`;
    }
    if (s.kind === "nightshift") {
      const r = await runNightShift();
      if (!r) return "engine unreachable";
      return `${r.orders.length} orders`;
    }
    const projectId = (await store.getSetting("prodProjectId").catch(() => null)) || process.env.GCP_PROJECT_ID || "";
    if (!projectId) return "no GCP project set";
    const r = await runLogWatch(projectId);
    if (!r) return "engine unreachable";
    return r.configured ? `${r.total} errors` : "log watch unconfigured";
  } catch (e) {
    return `error: ${(e as Error).message.slice(0, 120)}`;
  }
}

export interface TickResult {
  ran: number;
  advanced: number;
  results: Array<{ id: string; kind: string; status: string }>;
}

/** Run every due schedule once and advance unfinished builds. */
export async function tickAutopilot(): Promise<TickResult> {
  const all = await store.listSchedules().catch(() => []);
  const results: TickResult["results"] = [];
  for (const s of all) {
    if (!scheduleDue(s)) continue;
    const status = await executeSchedule(s);
    const at = new Date().toISOString();
    await store.saveSchedule({ ...s, lastRunAt: at, lastStatus: status, updatedAt: at }).catch(() => {});
    results.push({ id: s.id, kind: s.kind, status });
  }
  const advanced = await advanceStuckBuilds().catch(() => 0);
  return { ran: results.length, advanced, results };
}
