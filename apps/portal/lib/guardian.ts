// Portal clients for the Guardian suite engine endpoints.
// Same bridge pattern as lib/engine.ts: null on any failure, pages degrade.

import { readArtifact } from "./engine";
import { isDemoAccount, sampleA11yReports, sampleBriefs as demoBriefs, sampleClusters, sampleDigests, sampleFirstRunReports, sampleLogWatch, samplePentestReports, sampleSweeps, sampleWorkOrders, sampleZoom } from "./demo-samples";
import type {
  A11yView, BriefView, DigestView, FirstRunView, LogWatchView, PentestView, SignalClusterView, SweepView, WorkOrderStepView, WorkOrderView, ZoomView,
} from "./types";

function base(): string {
  return (process.env.ENGINE_URL ?? "http://localhost:3103").replace(/\/$/, "");
}

function headers(account?: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ENGINE_TOKEN) h["x-engine-token"] = process.env.ENGINE_TOKEN;
  // Engine stores Guardian data per account; no account means shared.
  if (account) h["x-charie-account"] = account;
  return h;
}

async function get<T>(path: string, timeout = 30000, account?: string): Promise<T | null> {
  try {
    const res = await fetch(`${base()}${path}`, {
      headers: headers(account),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown, timeout = 120000, account?: string): Promise<T | null> {
  try {
    const res = await fetch(`${base()}${path}`, {
      method: "POST",
      headers: headers(account),
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Redesign briefs for a run, from the briefs.json artifact. */
export async function readBriefs(runId: string): Promise<BriefView[]> {
  const f = await readArtifact(runId, ["briefs.json"]);
  if (!f) return demoBriefs(runId);
  try {
    return JSON.parse(f.data.toString("utf8")) as BriefView[];
  } catch {
    return [];
  }
}

/**
 * Targets for pentest and night-shift runs. Locally the engine has no
 * PORTAL_URL/ENGINE_PUBLIC_URL configured, so runs failed with "targets
 * required" and buttons appeared to do nothing. When the engine is a
 * local one, the portal supplies its own well-known local addresses;
 * hosted engines keep using their configured environment targets.
 */
export function localRunTargets(engineBaseUrl: string): { portalUrl: string; engineUrl: string } | Record<string, never> {
  return /localhost|127\.0\.0\.1/.test(engineBaseUrl)
    ? { portalUrl: process.env.PORTAL_PUBLIC_URL ?? "http://localhost:3102", engineUrl: engineBaseUrl }
    : {};
}

export async function listWorkOrders(account?: string): Promise<WorkOrderView[]> {
  const r = await get<{ workorders: WorkOrderView[] }>("/workorders", 30000, account);
  const orders = r?.workorders ?? [];
  if (orders.length > 0 || !isDemoAccount(account)) return orders;
  // Demo Mode: turn the sample orders into real engine records the first
  // time they are needed, so approving, scheduling, and running the night
  // shift actually persist across refreshes instead of acting on
  // read-only portal fallbacks that evaporate. Engine unreachable keeps
  // the labelled samples for browsing.
  for (const s of sampleWorkOrders()) {
    const created = await createWorkOrder({ title: s.title, source: "manual", sourceRef: s.sourceRef, plan: s.plan }, account).catch(() => null);
    if (created && s.status === "scheduled") await scheduleWorkOrder(created.id, account).catch(() => null);
  }
  const seeded = await get<{ workorders: WorkOrderView[] }>("/workorders", 30000, account).catch(() => null);
  return seeded?.workorders?.length ? seeded.workorders : sampleWorkOrders();
}

export async function getWorkOrder(id: string, account?: string): Promise<WorkOrderView | null> {
  const real = await get<WorkOrderView>(`/workorders/${encodeURIComponent(id)}`, 30000, account);
  if (real) return real;
  return isDemoAccount(account) ? (sampleWorkOrders().find((o) => o.id === id) ?? null) : null;
}

export async function createWorkOrder(input: {
  title: string; source: string; sourceRef: string; plan: WorkOrderStepView[];
}, account?: string): Promise<WorkOrderView | null> {
  return post<WorkOrderView>("/workorders", input, 120000, account);
}

export async function approveWorkOrder(id: string, by: string, account?: string): Promise<WorkOrderView | null> {
  return post<WorkOrderView>(`/workorders/${encodeURIComponent(id)}/approve`, { by }, 120000, account);
}

export async function scheduleWorkOrder(id: string, account?: string): Promise<WorkOrderView | null> {
  return post<WorkOrderView>(`/workorders/${encodeURIComponent(id)}/schedule`, {}, 120000, account);
}

export async function runNightShift(orderIds?: string[], account?: string): Promise<DigestView | null> {
  return post<DigestView>("/nightshift/run", { ...(orderIds ? { orderIds } : {}), ...localRunTargets(base()) }, 600000, account);
}

export async function listDigests(account?: string): Promise<DigestView[]> {
  const r = await get<{ digests: DigestView[] }>("/nightshift/digests", 30000, account);
  const digests = r?.digests ?? [];
  return digests.length === 0 && isDemoAccount(account) ? sampleDigests() : digests;
}

export async function listClusters(account?: string): Promise<{ total: number; clusters: SignalClusterView[] }> {
  const r = await get<{ total: number; clusters: SignalClusterView[] }>("/signals/clusters", 30000, account);
  const out = r ?? { total: 0, clusters: [] };
  return out.clusters.length === 0 && isDemoAccount(account) ? sampleClusters() : out;
}

export async function ingestSignals(messages: Array<{ channel?: string; author?: string; text: string }>, account?: string): Promise<{
  ingested: number; total: number; clusters: SignalClusterView[];
} | null> {
  return post("/signals/ingest", { messages }, 180000, account);
}

export async function seedSignals(account?: string): Promise<{ ingested: number; total: number; clusters: SignalClusterView[] } | null> {
  return post("/signals/seed", {}, 180000, account);
}

/** Pentest with the engine's real status, so a 429 busy reads as busy, not unreachable. */
export async function runPentestDetailed(account?: string): Promise<{ report: PentestView | null; status: number; error?: string }> {
  try {
    const res = await fetch(`${base()}/pentest/run`, {
      method: "POST",
      headers: headers(account),
      body: JSON.stringify(localRunTargets(base())),
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return { report: null, status: res.status, error: j.error };
    }
    return { report: (await res.json()) as PentestView, status: res.status };
  } catch {
    return { report: null, status: 0, error: "engine unreachable" };
  }
}

export async function runPentest(account?: string): Promise<PentestView | null> {
  return post<PentestView>("/pentest/run", localRunTargets(base()), 180000, account);
}

export async function listPentestReports(account?: string): Promise<PentestView[]> {
  const r = await get<{ reports: PentestView[] }>("/pentest/reports", 30000, account);
  const reports = r?.reports ?? [];
  return reports.length === 0 && isDemoAccount(account) ? samplePentestReports() : reports;
}

export async function listSweeps(account?: string): Promise<SweepView[]> {
  const r = await get<{ sweeps: SweepView[] }>("/guardian/sweeps", 30000, account);
  const sweeps = r?.sweeps ?? [];
  return sweeps.length === 0 && isDemoAccount(account) ? sampleSweeps() : sweeps;
}

export async function runSweep(account?: string): Promise<SweepView | null> {
  return post<SweepView>("/guardian/sweep", {}, 120000, account);
}

export async function zoomStatus(account?: string): Promise<ZoomView | null> {
  const real = await get<ZoomView>("/zoom/status");
  if (real) return real;
  return isDemoAccount(account) ? sampleZoom() : null;
}

export async function zoomJoin(meetingUrl: string): Promise<{ id: string } | null> {
  return post<{ id: string }>("/zoom/join", { meetingUrl });
}

export async function runA11y(targetUrl: string, account?: string): Promise<A11yView | null> {
  return post<A11yView>("/a11y/run", { targetUrl }, 300000, account);
}

export async function listA11yReports(account?: string): Promise<A11yView[]> {
  const r = await get<{ reports: A11yView[] }>("/a11y/reports", 30000, account);
  const reports = r?.reports ?? [];
  return reports.length === 0 && isDemoAccount(account) ? sampleA11yReports() : reports;
}

export async function runFirstRun(targetUrl: string, account?: string): Promise<FirstRunView | null> {
  return post<FirstRunView>("/firstrun/run", { targetUrl }, 300000, account);
}

export async function listFirstRunReports(account?: string): Promise<FirstRunView[]> {
  const r = await get<{ reports: FirstRunView[] }>("/firstrun/reports", 30000, account);
  const reports = r?.reports ?? [];
  return reports.length === 0 && isDemoAccount(account) ? sampleFirstRunReports() : reports;
}

export async function runLogWatch(projectId: string, account?: string): Promise<LogWatchView | null> {
  return post<LogWatchView>("/guardian/logwatch", { projectId }, 120000, account);
}

export async function lastLogWatch(account?: string): Promise<LogWatchView | null> {
  const r = await get<{ report: LogWatchView | null }>("/guardian/logwatch", 30000, account);
  if (r?.report) return r.report;
  return isDemoAccount(account) ? sampleLogWatch() : null;
}
