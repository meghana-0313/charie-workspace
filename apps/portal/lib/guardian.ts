// Portal clients for the Guardian suite engine endpoints.
// Same bridge pattern as lib/engine.ts: null on any failure, pages degrade.

import { readArtifact } from "./engine";
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
  if (!f) return [];
  try {
    return JSON.parse(f.data.toString("utf8")) as BriefView[];
  } catch {
    return [];
  }
}

export async function listWorkOrders(account?: string): Promise<WorkOrderView[]> {
  const r = await get<{ workorders: WorkOrderView[] }>("/workorders", 30000, account);
  return r?.workorders ?? [];
}

export async function getWorkOrder(id: string, account?: string): Promise<WorkOrderView | null> {
  return get<WorkOrderView>(`/workorders/${encodeURIComponent(id)}`, 30000, account);
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
  return post<DigestView>("/nightshift/run", orderIds ? { orderIds } : {}, 600000, account);
}

export async function listDigests(account?: string): Promise<DigestView[]> {
  const r = await get<{ digests: DigestView[] }>("/nightshift/digests", 30000, account);
  return r?.digests ?? [];
}

export async function listClusters(account?: string): Promise<{ total: number; clusters: SignalClusterView[] }> {
  const r = await get<{ total: number; clusters: SignalClusterView[] }>("/signals/clusters", 30000, account);
  return r ?? { total: 0, clusters: [] };
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
      body: JSON.stringify({}),
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
  return post<PentestView>("/pentest/run", {}, 180000, account);
}

export async function listPentestReports(account?: string): Promise<PentestView[]> {
  const r = await get<{ reports: PentestView[] }>("/pentest/reports", 30000, account);
  return r?.reports ?? [];
}

export async function listSweeps(account?: string): Promise<SweepView[]> {
  const r = await get<{ sweeps: SweepView[] }>("/guardian/sweeps", 30000, account);
  return r?.sweeps ?? [];
}

export async function runSweep(account?: string): Promise<SweepView | null> {
  return post<SweepView>("/guardian/sweep", {}, 120000, account);
}

export async function zoomStatus(): Promise<ZoomView | null> {
  return get<ZoomView>("/zoom/status");
}

export async function zoomJoin(meetingUrl: string): Promise<{ id: string } | null> {
  return post<{ id: string }>("/zoom/join", { meetingUrl });
}

export async function runA11y(targetUrl: string, account?: string): Promise<A11yView | null> {
  return post<A11yView>("/a11y/run", { targetUrl }, 300000, account);
}

export async function listA11yReports(account?: string): Promise<A11yView[]> {
  const r = await get<{ reports: A11yView[] }>("/a11y/reports", 30000, account);
  return r?.reports ?? [];
}

export async function runFirstRun(targetUrl: string, account?: string): Promise<FirstRunView | null> {
  return post<FirstRunView>("/firstrun/run", { targetUrl }, 300000, account);
}

export async function listFirstRunReports(account?: string): Promise<FirstRunView[]> {
  const r = await get<{ reports: FirstRunView[] }>("/firstrun/reports", 30000, account);
  return r?.reports ?? [];
}

export async function runLogWatch(projectId: string, account?: string): Promise<LogWatchView | null> {
  return post<LogWatchView>("/guardian/logwatch", { projectId }, 120000, account);
}

export async function lastLogWatch(account?: string): Promise<LogWatchView | null> {
  const r = await get<{ report: LogWatchView | null }>("/guardian/logwatch", 30000, account);
  return r?.report ?? null;
}
