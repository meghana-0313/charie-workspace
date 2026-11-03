// Report browser: tile or list view over individual report summaries.
// View, kind filter, search and sort are client-side over the summaries
// the server page passes in; every item opens its own report page.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReportSummary } from "@/lib/reports";
import { DateRangePicker } from "./date-range";

const SEV_ORDER: Record<string, number> = { blocker: 0, critical: 0, major: 1, high: 1, minor: 2, low: 3 };

export function ReportBrowser({ reports }: { reports: ReportSummary[] }) {
  const [view, setView] = useState<"tile" | "list">("tile");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("newest");
  const kinds = useMemo(() => [...new Set(reports.map((r) => r.kind))], [reports]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = reports.filter((r) =>
      (kind === "all" || r.kind === kind) &&
      (!needle || `${r.title} ${r.target} ${r.id}`.toLowerCase().includes(needle)));
    out.sort((a, b) => {
      if (sort === "oldest") return a.at.localeCompare(b.at);
      if (sort === "severity") return (SEV_ORDER[a.severity ?? ""] ?? 9) - (SEV_ORDER[b.severity ?? ""] ?? 9);
      if (sort === "status") return a.status.localeCompare(b.status);
      return b.at.localeCompare(a.at);
    });
    return out;
  }, [reports, q, kind, sort]);

  const href = (r: ReportSummary) => `/reports/${r.kind}/${r.id}`;
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div className="row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports…" aria-label="Search reports" style={{ width: 220 }} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Report type">
            <option value="all">All types</option>
            {kinds.map((k) => <option key={k} value={k}>{reports.find((r) => r.kind === k)?.kindLabel ?? k}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort reports">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="severity">Severity</option>
            <option value="status">Status</option>
          </select>
          <DateRangePicker />
        </div>
        <div className="tabs" style={{ margin: 0 }} role="group" aria-label="View mode">
          <button type="button" className={`tab${view === "tile" ? " on" : ""}`} onClick={() => setView("tile")} aria-pressed={view === "tile"}>Tile view</button>
          <button type="button" className={`tab${view === "list" ? " on" : ""}`} onClick={() => setView("list")} aria-pressed={view === "list"}>List view</button>
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="empty"><div className="empty-title">No reports match</div>Run a scan, investigation, or analysis and its individual report appears here.</div>
      ) : view === "tile" ? (
        <div className="report-tiles">
          {shown.map((r) => (
            <Link key={`${r.kind}-${r.id}`} href={href(r)} className="report-tile">
              <span className="small muted">{r.kindLabel} · {r.at.slice(0, 16).replace("T", " ")}</span>
              <strong>{r.title}</strong>
              <span className="small muted">{r.target.slice(0, 60)}</span>
              <span className="row"><span className="badge" data-tone={r.status === "failed" ? "failed" : r.status === "done" ? "done" : undefined} style={r.status === "failed" ? { background: "var(--danger-dim)", color: "var(--danger)" } : r.status === "done" ? { background: "var(--ok-dim)", color: "var(--ok)" } : undefined}>{r.status}</span>{r.severity && <span className={`sev ${r.severity}`}>{r.severity}</span>}<span className="small muted">{r.result}</span></span>
              <span className="small mono muted">{r.id}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead><tr><th>Type</th><th>Report</th><th>Target</th><th>Result</th><th>Status</th><th>When</th><th></th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.kind}-${r.id}`}>
                  <td className="small">{r.kindLabel}</td>
                  <td><Link href={href(r)}><strong>{r.title}</strong></Link><br /><span className="small mono muted">{r.id}</span></td>
                  <td className="small muted">{r.target.slice(0, 44)}</td>
                  <td className="small">{r.result}</td>
                  <td><span className="badge">{r.status}</span></td>
                  <td className="small muted">{r.at.slice(0, 16).replace("T", " ")}</td>
                  <td><Link href={href(r)}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
