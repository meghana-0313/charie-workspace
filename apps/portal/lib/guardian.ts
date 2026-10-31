// Portal clients for the Guardian suite engine endpoints.
// Same bridge pattern as lib/engine.ts: null on any failure, pages degrade.

import { readArtifact } from "./engine";
import type {
  A11yView, BriefView, DigestView, FirstRunView, PentestView, SignalClusterView, SweepView, WorkOrderStepView, WorkOrderView, ZoomView,
} from "./types";

function base(): string {
  return (process.env.ENGINE_URL ?? "http://localhost:3103").replace(/\/$/, "");
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ENGINE_TOKEN) h["x-engine-token"] = process.env.ENGINE_TOKEN;
  return h;
}

async function get<T>(path: string, timeout = 30000): Promise<T | null> {
  try {
    const res = await fetch(`${base()}${path}`, {
      headers: headers(),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown, timeout = 120000): Promise<T | null> {
  try {
    const res = await fetch(`${base()}${path}`, {
      method: "POST",
      headers: headers(),
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

export async function listWorkOrders(): Promise<WorkOrderView[]> {
  const r = await get<{ workorders: WorkOrderView[] }>("/workorders");
  return r?.workorders ?? [];
}

export async function getWorkOrder(id: string): Promise<WorkOrderView | null> {
  return get<WorkOrderView>(`/workorders/${encodeURIComponent(id)}`);
}

export async function createWorkOrder(input: {
  title: string; source: string; sourceRef: string; plan: WorkOrderStepView[];
}): Promise<WorkOrderView | null> {
  return post<WorkOrderView>("/workorders", input);
}

export async function approveWorkOrder(id: string, by: string): Promise<WorkOrderView | null> {
  return post<WorkOrderView>(`/workorders/${encodeURIComponent(id)}/approve`, { by });
}

export async function scheduleWorkOrder(id: string): Promise<WorkOrderView | null> {
  return post<WorkOrderView>(`/workorders/${encodeURIComponent(id)}/schedule`, {});
}

export async function runNightShift(orderIds?: string[]): Promise<DigestView | null> {
  return post<DigestView>("/nightshift/run", orderIds ? { orderIds } : {}, 600000);
}

export async function listDigests(): Promise<DigestView[]> {
  const r = await get<{ digests: DigestView[] }>("/nightshift/digests");
  return r?.digests ?? [];
}

export async function listClusters(): Promise<{ total: number; clusters: SignalClusterView[] }> {
  const r = await get<{ total: number; clusters: SignalClusterView[] }>("/signals/clusters");
  return r ?? { total: 0, clusters: [] };
}

export async function ingestSignals(messages: Array<{ channel?: string; author?: string; text: string }>): Promise<{
  ingested: number; total: number; clusters: SignalClusterView[];
} | null> {
  return post("/signals/ingest", { messages }, 180000);
}

export async function seedSignals(): Promise<{ ingested: number; total: number; clusters: SignalClusterView[] } | null> {
  return post("/signals/seed", {}, 180000);
}

export async function runPentest(): Promise<PentestView | null> {
  return post<PentestView>("/pentest/run", {}, 180000);
}

export async function listPentestReports(): Promise<PentestView[]> {
  const r = await get<{ reports: PentestView[] }>("/pentest/reports");
  return r?.reports ?? [];
}

export async function listSweeps(): Promise<SweepView[]> {
  const r = await get<{ sweeps: SweepView[] }>("/guardian/sweeps");
  return r?.sweeps ?? [];
}

export async function runSweep(): Promise<SweepView | null> {
  return post<SweepView>("/guardian/sweep", {});
}

export async function zoomStatus(): Promise<ZoomView | null> {
  return get<ZoomView>("/zoom/status");
}

export async function zoomJoin(meetingUrl: string): Promise<{ id: string } | null> {
  return post<{ id: string }>("/zoom/join", { meetingUrl });
}

export async function runA11y(targetUrl: string): Promise<A11yView | null> {
  return post<A11yView>("/a11y/run", { targetUrl }, 300000);
}

export async function listA11yReports(): Promise<A11yView[]> {
  const r = await get<{ reports: A11yView[] }>("/a11y/reports");
  return r?.reports ?? [];
}

export async function runFirstRun(targetUrl: string): Promise<FirstRunView | null> {
  return post<FirstRunView>("/firstrun/run", { targetUrl }, 300000);
}

export async function listFirstRunReports(): Promise<FirstRunView[]> {
  const r = await get<{ reports: FirstRunView[] }>("/firstrun/reports");
  return r?.reports ?? [];
}
