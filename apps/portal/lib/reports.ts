// Unified individual reports: every execution (pentest, a11y, first run,
// agent run, guardian incident) is one report with a permanent id at
// /reports/<kind>/<id>. Lists come from the existing owners - no duplicate
// data source. Absent fields stay absent here and render as Not Recorded.

import { listA11yReports, listFirstRunReports, listPentestReports } from "./guardian";
import { readFindings, readReportMd } from "./engine";
import { store } from "./store";
import type { A11yView, FirstRunView, Incident, PentestView, PortalRun } from "./types";

export type ReportKind = "pentest" | "a11y" | "firstrun" | "agent-run" | "incident";

export interface ReportSummary {
  id: string;
  kind: ReportKind;
  kindLabel: string;
  title: string;
  target: string;
  at: string;
  status: string;
  result: string;
  severity?: string;
  failedCount?: number;
}

export interface ReportDetail extends ReportSummary {
  payload: unknown;
  findings?: Array<{ id: string; title: string; severity: string; suspectedCause?: string; analysisSource?: string }>;
  reportMd?: string | null;
  incident?: Incident;
}

const KIND_LABEL: Record<ReportKind, string> = {
  pentest: "Security scan",
  a11y: "Accessibility",
  firstrun: "First run",
  "agent-run": "Agent run",
  incident: "Threat incident",
};

function pentestSummary(r: PentestView): ReportSummary {
  return {
    id: r.id, kind: "pentest", kindLabel: KIND_LABEL.pentest,
    title: `Security scan - grade ${r.grade}`,
    target: r.targets.join(", ") || "Not Recorded",
    at: r.at, status: r.failed > 0 ? "Findings" : "Passed",
    result: `${r.passed} passed, ${r.failed} failed`,
    severity: r.checks.find((c) => !c.pass)?.severity,
    failedCount: r.failed,
  };
}

function a11ySummary(r: A11yView): ReportSummary {
  return {
    id: r.id, kind: "a11y", kindLabel: KIND_LABEL.a11y,
    title: `Accessibility - grade ${r.grade}`,
    target: r.targetUrl, at: r.at, status: r.failed > 0 ? "Findings" : "Passed",
    result: `${r.passed} passed, ${r.failed} failed`,
    severity: r.checks.find((c) => !c.pass)?.severity,
    failedCount: r.failed,
  };
}

function firstrunSummary(r: FirstRunView): ReportSummary {
  return {
    id: r.id, kind: "firstrun", kindLabel: KIND_LABEL.firstrun,
    title: `First run - score ${r.score}`,
    target: r.targetUrl, at: r.at, status: r.failed > 0 ? "Findings" : "Passed",
    result: `${r.passed} passed, ${r.failed} failed`,
    failedCount: r.failed,
  };
}

function runSummary(r: PortalRun): ReportSummary {
  return {
    id: r.id, kind: "agent-run", kindLabel: KIND_LABEL["agent-run"],
    title: `${r.kind === "verify" ? "Verification" : "Investigation"} run`,
    target: r.targetUrl, at: r.createdAt, status: r.status,
    result: `Ticket ${r.ticketId}`,
  };
}

function incidentSummary(i: Incident): ReportSummary {
  return {
    id: i.id, kind: "incident", kindLabel: KIND_LABEL.incident,
    title: i.title, target: "Production signals", at: i.createdAt,
    status: i.status, result: i.investigation?.verdict ?? i.mode,
    severity: i.severity,
  };
}

export async function listReportSummaries(uid?: string): Promise<ReportSummary[]> {
  const [pentest, a11y, firstrun, runs, incidents] = await Promise.all([
    listPentestReports(uid).catch(() => [] as PentestView[]),
    listA11yReports(uid).catch(() => [] as A11yView[]),
    listFirstRunReports(uid).catch(() => [] as FirstRunView[]),
    store.listRuns(50, uid).catch(() => [] as PortalRun[]),
    store.listIncidents(uid).catch(() => [] as Incident[]),
  ]);
  return [
    ...pentest.map(pentestSummary),
    ...a11y.map(a11ySummary),
    ...firstrun.map(firstrunSummary),
    ...runs.map(runSummary),
    ...incidents.map(incidentSummary),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

export async function getReportDetail(kind: string, id: string, uid?: string): Promise<ReportDetail | null> {
  if (kind === "pentest") {
    const r = (await listPentestReports(uid).catch(() => [])).find((x) => x.id === id);
    return r ? { ...pentestSummary(r), payload: r } : null;
  }
  if (kind === "a11y") {
    const r = (await listA11yReports(uid).catch(() => [])).find((x) => x.id === id);
    return r ? { ...a11ySummary(r), payload: r } : null;
  }
  if (kind === "firstrun") {
    const r = (await listFirstRunReports(uid).catch(() => [])).find((x) => x.id === id);
    return r ? { ...firstrunSummary(r), payload: r } : null;
  }
  if (kind === "agent-run") {
    const run = await store.getRun(id).catch(() => null);
    if (!run || (uid && run.uid && run.uid !== uid)) return null;
    const [findings, reportMd] = await Promise.all([
      readFindings(id).catch(() => null),
      readReportMd(id).catch(() => null),
    ]);
    return {
      ...runSummary(run), payload: run,
      findings: (findings ?? []).map((f) => ({ id: f.id, title: f.title, severity: f.severity, suspectedCause: f.suspectedCause, analysisSource: f.analysisSource })),
      reportMd,
    };
  }
  if (kind === "incident") {
    const incident = await store.getIncident(id).catch(() => null);
    if (!incident || (uid && incident.uid && incident.uid !== uid)) return null;
    return { ...incidentSummary(incident), payload: incident, incident };
  }
  return null;
}
