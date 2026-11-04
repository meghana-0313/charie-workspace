import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { listDigests, listSweeps, listWorkOrders } from "@/lib/guardian";
import { GetStarted } from "@/components/onboard";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return iso.slice(5, 16).replace("T", " ");
}
function initials(name: string): string {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "C";
}

export default async function Dashboard() {
  const id = await identity();
  const myUid = scopeUid(id);
  const [tickets, runs, incidents, repos, sweeps, schedules, digests, orders] = await Promise.all([
    store.listTickets(myUid),
    store.listRuns(10, myUid),
    store.listIncidents(myUid),
    store.listRepos(myUid),
    listSweeps(myUid),
    store.listSchedules(myUid).catch(() => []),
    listDigests(myUid),
    listWorkOrders(myUid),
  ]);
  const openTickets = tickets.filter((t) => t.status !== "closed" && t.status !== "verified");
  const openIncidents = incidents.filter((i) => i.status === "open");
  const activeRuns = runs.filter((r) => r.status === "running").length + tickets.filter((t) => t.status === "investigating").length;
  const pendingApprovals = orders.filter((o) => o.status === "proposed").length;
  const verified7d = runs.filter((r) => r.kind === "verify" && r.status === "done" && Date.now() - new Date(r.createdAt).getTime() < 7 * 864e5).length;
  const lastSweep = sweeps.at(-1);
  const lastDigest = digests.at(-1);
  const firstName = (id?.name ?? id?.email ?? "").split(/[\s@]/)[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const topIssue = openIncidents[0] ?? openTickets[0];
  const queue = [
    ...openIncidents.slice(0, 3).map((i) => ({ kind: "incident" as const, id: i.id, title: i.title, sub: "Production incident", sev: "critical", status: i.status, at: i.createdAt, href: `/guardian/${i.id}` })),
    ...openTickets.slice(0, 5).map((t) => ({ kind: "ticket" as const, id: t.id, title: t.subject, sub: t.goal, sev: t.status === "investigating" ? "high" : "medium", status: t.status, at: t.createdAt, href: `/tickets/${t.id}` })),
  ].slice(0, 6);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <div>
          <h1 className="hero-title">{greet}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Here&apos;s what&apos;s happening with {repos[0] ? `${repos[0].owner}/${repos[0].repo}` : "your workspace"} today.</p>
        </div>
        <div className="row">
          <span className="badge"><Icon name="calendar" size={13} /> {today}</span>
          <Link href="/tickets?new=1" className="btn">+ New investigation</Link>
        </div>
      </div>

      {(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(Date.now() - (6 - i) * 864e5);
          const key = d.toISOString().slice(0, 10);
          return { label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), narrow: d.toLocaleDateString("en-US", { weekday: "narrow" }), count: runs.filter((r) => r.createdAt.slice(0, 10) === key).length };
        });
        const maxDay = Math.max(1, ...days.map((d) => d.count));
        const sweepPts = sweeps.slice(-10).map((s, i) => `${i * 28},${64 - (s.pass ? 52 : 10)}`).join(" ");
        const doneRuns = runs.filter((r) => r.status === "done").length;
        const failedRuns = runs.filter((r) => r.status === "failed").length;
        const activeRuns = Math.max(0, runs.length - doneRuns - failedRuns);
        const runPct = runs.length ? Math.round((doneRuns / runs.length) * 100) : 0;
        const failPct = runs.length ? Math.round((failedRuns / runs.length) * 100) : 0;
        const activePct = Math.max(0, 100 - runPct - failPct);
        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="card-title" style={{ margin: 0 }}>Analytics overview</div>
              <Link href="/reports" className="small">All reports</Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: "var(--space-4)" }} className="home-grid">
              <div>
                <div className="section-label">Agent runs, last 7 days</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 84 }} role="img" aria-label={`Runs per day: ${days.map((d) => d.count).join(", ")}`}>
                  {days.map((d, i) => (
                    <div key={i} style={{ flex: 1, textAlign: "center" }} title={`${d.label}: ${d.count} run(s)`}>
                      <div className="small" style={{ fontWeight: 600 }}>{d.count}</div>
                      <div style={{ height: 48, display: "flex", alignItems: "flex-end" }}><div style={{ width: "100%", height: `${Math.max(6, (d.count / maxDay) * 100)}%`, background: i === 6 ? "var(--accent)" : "var(--accent)", opacity: i === 6 ? 1 : 0.45, borderRadius: 4, transition: "height .6s ease" }} /></div>
                      <div className="small muted">{d.narrow}</div>
                    </div>
                  ))}
                </div>
                <p className="small muted" style={{ margin: "4px 0 0" }}>{runs.length} run(s) on record, {doneRuns} finished.</p>
              </div>
              <div>
                <div className="section-label">Run completion</div>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <span className="donut" title={runs.length ? `${doneRuns} finished (${runPct}%), ${failedRuns} failed (${failPct}%), ${activeRuns} in progress (${activePct}%)` : "No runs yet"} style={{ background: runs.length === 0 ? "var(--surface-overlay)" : `conic-gradient(var(--ok) 0% ${runPct}%, var(--danger) ${runPct}% ${runPct + failPct}%, var(--warn) ${runPct + failPct}% ${runPct + failPct + activePct}%, var(--surface-overlay) ${runPct + failPct + activePct}%)` }}><span style={{ background: "var(--surface)", borderRadius: "50%", width: 56, height: 56, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><strong>{runs.length ? `${runPct}%` : "-"}</strong></span></span>
                  <span className="small muted">{runs.length === 0 ? "No runs yet - the chart fills in as Charie works." : <><span style={{ color: "var(--ok)" }}>●</span> {doneRuns} finished ({runPct}%) · <span style={{ color: "var(--danger)" }}>●</span> {failedRuns} failed ({failPct}%) · <span style={{ color: "var(--warn)" }}>●</span> {activeRuns} in progress ({activePct}%)<br />{openTickets.length} ticket(s) still open.</>}</span>
                </div>
              </div>
              <div>
                <div className="section-label">Sweep health</div>
                {sweeps.length === 0 ? <p className="small muted">No sweeps yet. Guardian sweeps draw their trend here.</p> : (
                  <>
                    <svg viewBox="0 0 260 76" style={{ width: "100%", height: 76 }} role="img" aria-label="Sweep pass trend">
                      <polyline points={sweepPts || "0,64 252,12"} fill="none" stroke="var(--ok)" strokeWidth="2.5" />
                      {sweeps.slice(-10).map((s, i) => <circle key={i} cx={i * 28} cy={64 - (s.pass ? 52 : 10)} r="4" fill={s.pass ? "var(--ok)" : "var(--danger)"}><title>{`${s.at.slice(0, 16).replace("T", " ")}: ${s.pass ? "passed" : "failed"}`}</title></circle>)}
                    </svg>
                    <p className="small muted" style={{ margin: "4px 0 0" }}>{sweeps.filter((s) => s.pass).length}/{sweeps.length} sweeps passed.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="status-banner" style={openIncidents.length > 0 ? { borderColor: "var(--danger)" } : undefined}>
        <span className={`icon-orb ${openIncidents.length > 0 ? "red" : "green"}`}><Icon name={openIncidents.length > 0 ? "alert" : "check"} size={22} /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ color: openIncidents.length > 0 ? "var(--danger)" : "var(--ok)", fontSize: "var(--text-lg)" }}>{openIncidents.length === 0 ? "All systems operational" : `${openIncidents.length} incident(s) need attention`}</strong>
          <div className="small muted">{openIncidents.length === 0 ? "Running smoothly. No critical incidents." : "Charie is investigating. Review the priority queue below."}</div>
        </div>
        <span className="small"><strong>{repos[0] ? `${repos[0].owner}/${repos[0].repo}` : "No repo connected"}</strong><br /><span className="muted">{repos[0]?.branch ?? "no branch"}</span></span>
        <span className="small"><span className="env-dot" style={{ display: "inline-block", marginRight: 6 }} />{process.env.PORTAL_STORE === "firestore" ? "Production" : "Development"}</span>
        <span className="small muted">Last check: {lastSweep ? when(lastSweep.at) : "never"}</span>
      </div>

      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb red"><Icon name="alert" size={20} /></span><div><div className="stat-num">{openIncidents.length}</div><div className="stat-label">Open incidents</div></div><span className="spacer" /><span className="delta-up">{openIncidents.length ? "↑ open" : ""}</span></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="layers" size={20} /></span><div><div className="stat-num">{activeRuns}</div><div className="stat-label">Active investigations</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="clock" size={20} /></span><div><div className="stat-num">{pendingApprovals}</div><div className="stat-label">Pending approvals</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{verified7d}</div><div className="stat-label">Verified fixes (7d)</div></div></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div>
        <div className="card">
          <div className="card-title">Priority queue</div>
          <p className="muted small">Issues that need your attention, ordered by impact.</p>
          {queue.length === 0 ? <p className="muted small">All clear. File a ticket when a customer hits a wall.</p> : (
            <table>
              <thead><tr><th>Severity</th><th>Issue</th><th>Owner</th><th>Age</th><th>Status</th></tr></thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={`${q.kind}-${q.id}`}>
                    <td><span className={`sev ${q.sev}`}>{q.sev === "critical" ? "Critical" : q.sev === "high" ? "High" : "Medium"}</span></td>
                    <td><Link href={q.href}><strong>{q.title}</strong></Link><br /><span className="small muted">{q.sub.slice(0, 64)}</span></td>
                    <td><span className="row" style={{ flexWrap: "nowrap" }}><span className="initials">{initials(firstName || "Charie")}</span><span className="small">{firstName || "You"}</span></span></td>
                    <td className="small muted">{when(q.at)}</td>
                    <td><Badge tone={q.status}>{q.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}><div className="card-title" style={{ margin: 0 }}>Recent agent activity</div><span className="row"><Link href="/reports" className="small">All reports</Link><Link href="/tickets" className="small">View all runs →</Link></span></div>
        <p className="muted small">Latest actions taken by Charie and your agents.</p>
        {runs.length === 0 ? <p className="muted small">No runs yet.</p> : (
          <div className="activity-rail">
            {runs.slice(0, 5).map((r) => (
              <div key={r.id} className="activity-node">
                <span className={`icon-orb ${r.status === "done" ? "green" : r.status === "failed" ? "red" : "violet"}`}><Icon name={r.kind === "verify" ? "flask" : "code"} size={20} /></span>
                <div><strong className="small">{r.kind === "verify" ? "Verification run" : "Investigation"} {r.status}</strong><br /><span className="small muted">{r.id.slice(0, 18)} · {r.targetUrl.replace(/^https?:\/\//, "").slice(0, 22)}</span><br /><span className="small muted">{when(r.createdAt)}</span> · <Link className="small" href={`/reports/agent-run/${r.id}`}>Report</Link></div>
              </div>
            ))}
          </div>
        )}
      </div>

        </div>

        <div>
          <GetStarted hasRepo={repos.length > 0} hasTicket={tickets.length > 0} hasRun={runs.length > 0} />
        <div className="card">
          <div className="card-title"><Icon name="spark" /> CHARIE insights <Badge tone="accent">Live</Badge></div>
          <p className="muted small">Analysis based on recent activity, errors, and logs.</p>
          {topIssue ? (
            <>
              <p><strong>Investigate “{topIssue.title ?? (topIssue as { subject?: string }).subject}” first</strong></p>
              <p className="small muted">It is the highest-impact open item right now. Charie can collect evidence and prepare a fix for your approval.</p>
              <div className="row"><Link className="btn sm" href={openIncidents[0] ? `/guardian/${openIncidents[0].id}` : `/tickets/${openTickets[0]?.id}`}>Run investigation</Link><Link className="btn secondary sm" href="/tickets">View evidence</Link></div>
            </>
          ) : <p className="small muted">No urgent items. Charie keeps watching sweeps, signals, and logs.</p>}
          <hr className="divider" />
          <p><strong>{lastDigest ? "Overnight digest is ready" : "Put Charie on night shift"}</strong></p>
          <p className="small muted">{lastDigest ? "The night shift summarized what changed while you slept." : `${schedules.filter((s) => s.enabled).length} schedule(s) active. Sweeps and re-scans run on their own.`}</p>
          <div className="row"><Link className="btn sm" href="/guardian/night">Open night shift</Link><Link className="btn secondary sm" href="/autopilot">Autopilot</Link></div>
        </div>
        </div>
      </div>

    </>
  );
}
