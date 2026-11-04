// Interactive home analytics: every bar, donut segment, legend row, and
// sweep point is clickable. Clicking opens a side panel listing the
// actual runs or sweeps behind that number, each linking to its report,
// plus the next-step destinations - nobody has to hunt for anything.
"use client";

import Link from "next/link";
import { useState } from "react";

export interface AnalyticsRunItem {
  id: string;
  kindLabel: string;
  status: string;
  at: string;
  href: string;
}

export interface AnalyticsDay {
  label: string;
  narrow: string;
  count: number;
  runs: AnalyticsRunItem[];
}

export interface AnalyticsSegment {
  key: string;
  label: string;
  color: string;
  count: number;
  pct: number;
  runs: AnalyticsRunItem[];
}

export interface AnalyticsSweep {
  id: string;
  at: string;
  pass: boolean;
  checks: Array<{ name: string; pass: boolean; evidence: string }>;
}

interface Selection {
  title: string;
  sub: string;
  runs?: AnalyticsRunItem[];
  sweep?: AnalyticsSweep;
}

function Panel({ sel, onClose }: { sel: Selection; onClose: () => void }) {
  return (
    <div role="dialog" aria-label={sel.title} style={{ position: "fixed", top: 0, right: 0, width: "min(430px, 94vw)", height: "100dvh", zIndex: 90, background: "var(--surface)", borderLeft: "1px solid var(--line)", boxShadow: "-18px 0 40px rgba(0,0,0,.35)", display: "flex", flexDirection: "column" }}>
      <div className="row" style={{ justifyContent: "space-between", padding: "16px 18px 10px" }}>
        <div>
          <strong style={{ fontSize: "var(--text-lg)" }}>{sel.title}</strong>
          <div className="small muted">{sel.sub}</div>
        </div>
        <button type="button" className="ghost sm" onClick={onClose} aria-label="Close panel">x</button>
      </div>
      <div style={{ overflowY: "auto", padding: "0 18px", flex: 1 }}>
        {sel.sweep ? (
          <>
            <p className="small">{sel.sweep.pass ? "This sweep passed." : "This sweep failed."} Checks:</p>
            {sel.sweep.checks.map((c, i) => (
              <div key={i} className="card" style={{ marginBottom: 8 }}>
                <strong className="small">{c.pass ? "Passed" : "Failed"}: {c.name}</strong>
                <p className="small muted" style={{ margin: "4px 0 0" }}>{c.evidence}</p>
              </div>
            ))}
          </>
        ) : sel.runs && sel.runs.length > 0 ? (
          sel.runs.map((r) => (
            <Link key={r.id} href={r.href} className="card" style={{ display: "block", marginBottom: 8, textDecoration: "none", color: "inherit" }}>
              <strong className="small">{r.kindLabel} - {r.status}</strong>
              <div className="small muted">{r.id.slice(0, 22)} - {r.at.slice(0, 16).replace("T", " ")}</div>
              <div className="small">Open report →</div>
            </Link>
          ))
        ) : (
          <p className="small muted">Nothing in this slice yet. When Charie runs work, the individual reports appear here and link straight to their pages.</p>
        )}
      </div>
      <div style={{ padding: "12px 18px 16px", borderTop: "1px solid var(--line)" }}>
        <div className="section-label">Next steps</div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Link className="btn sm" href="/reports">All reports</Link>
          <Link className="btn secondary sm" href="/tickets">Tickets</Link>
          <Link className="btn secondary sm" href="/guardian">Guardian</Link>
          <Link className="btn secondary sm" href="/tickets?new=1">New investigation</Link>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsOverview({ days, maxDay, segments, totalRuns, sweeps }: {
  days: AnalyticsDay[];
  maxDay: number;
  segments: AnalyticsSegment[];
  totalRuns: number;
  sweeps: AnalyticsSweep[];
}) {
  const [sel, setSel] = useState<Selection | null>(null);
  const sweepPts = sweeps.slice(-10).map((s, i) => `${i * 28},${64 - (s.pass ? 52 : 10)}`).join(" ");
  const donePct = segments.find((s) => s.key === "done")?.pct ?? 0;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="card-title" style={{ margin: 0 }}>Analytics overview</div>
        <span className="small muted">Click any bar, slice, or point for the reports behind it</span>
        <Link href="/reports" className="small">All reports</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: "var(--space-4)" }} className="home-grid">
        <div>
          <div className="section-label">Agent runs, last 7 days</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 84 }} role="img" aria-label={`Runs per day: ${days.map((d) => d.count).join(", ")}`}>
            {days.map((d, i) => (
              <button key={i} type="button" title={`${d.label}: ${d.count} run(s) - click to see them`} onClick={() => setSel({ title: `${d.label}: ${d.count} run(s)`, sub: "Runs Charie executed that day. Click one to open its report.", runs: d.runs })} style={{ flex: 1, textAlign: "center", background: "none", border: 0, cursor: "pointer", padding: 0, color: "inherit" }}>
                <div className="small" style={{ fontWeight: 600 }}>{d.count}</div>
                <div style={{ height: 48, display: "flex", alignItems: "flex-end" }}><div style={{ width: "100%", height: `${Math.max(6, (d.count / maxDay) * 100)}%`, background: "var(--accent)", opacity: i === 6 ? 1 : 0.45, borderRadius: 4 }} /></div>
                <div className="small muted">{d.narrow}</div>
              </button>
            ))}
          </div>
          <p className="small muted" style={{ margin: "4px 0 0" }}>{totalRuns} run(s) on record. Click a day to see its runs.</p>
        </div>
        <div>
          <div className="section-label">Run completion</div>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <button type="button" title="Click a legend item to see those runs" onClick={() => segments[0] && setSel({ title: `${segments[0].label}: ${segments[0].count} run(s)`, sub: "Click a run to open its report.", runs: segments[0].runs })} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
              <span className="donut" style={{ background: totalRuns === 0 ? "var(--surface-overlay)" : `conic-gradient(${segments.map((s) => `${s.color} ${segments.slice(0, segments.indexOf(s)).reduce((a, x) => a + x.pct, 0)}% ${segments.slice(0, segments.indexOf(s) + 1).reduce((a, x) => a + x.pct, 0)}%`).join(", ")}, var(--surface-overlay) 0)` }}><span style={{ background: "var(--surface)", borderRadius: "50%", width: 56, height: 56, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><strong>{totalRuns ? `${donePct}%` : "-"}</strong></span></span>
            </button>
            <span className="small muted">
              {totalRuns === 0 ? "No runs yet - the chart fills in as Charie works." : segments.map((s) => (
                <span key={s.key}>
                  <button type="button" className="ghost sm" title={`See the ${s.label.toLowerCase()} runs`} onClick={() => setSel({ title: `${s.label}: ${s.count} run(s)`, sub: "Click a run to open its report.", runs: s.runs })} style={{ padding: "0 2px", color: "inherit" }}>
                    <span style={{ color: s.color }}>●</span> {s.count} {s.label.toLowerCase()} ({s.pct}%)
                  </button>
                  <br />
                </span>
              ))}
            </span>
          </div>
        </div>
        <div>
          <div className="section-label">Sweep health</div>
          {sweeps.length === 0 ? <p className="small muted">No sweeps yet. Guardian sweeps draw their trend here. Click Guardian to run one.</p> : (
            <>
              <svg viewBox="0 0 260 76" style={{ width: "100%", height: 76 }} role="img" aria-label="Sweep pass trend">
                <polyline points={sweepPts || "0,64 252,12"} fill="none" stroke="var(--ok)" strokeWidth="2.5" />
                {sweeps.slice(-10).map((s, i) => (
                  <circle key={s.id} cx={i * 28} cy={64 - (s.pass ? 52 : 10)} r="7" fill={s.pass ? "var(--ok)" : "var(--danger)"} style={{ cursor: "pointer" }} onClick={() => setSel({ title: `Sweep ${s.pass ? "passed" : "failed"}`, sub: s.at.slice(0, 16).replace("T", " "), sweep: s })}>
                    <title>{`${s.at.slice(0, 16).replace("T", " ")}: ${s.pass ? "passed" : "failed"} - click for checks`}</title>
                  </circle>
                ))}
              </svg>
              <p className="small muted" style={{ margin: "4px 0 0" }}>{sweeps.filter((s) => s.pass).length}/{sweeps.length} sweeps passed. Click a point for its checks.</p>
            </>
          )}
        </div>
      </div>
      {sel && <Panel sel={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
