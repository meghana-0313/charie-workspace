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
          <Link href="/tickets#new" className="btn">+ New investigation</Link>
        </div>
      </div>

      <div className="status-banner">
        <span className="icon-orb green"><Icon name="check" size={22} /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong style={{ color: "var(--ok)", fontSize: "var(--text-lg)" }}>{openIncidents.length === 0 ? "All systems operational" : `${openIncidents.length} incident(s) need attention`}</strong>
          <div className="small muted">{openIncidents.length === 0 ? "Running smoothly. No critical incidents." : "Charie is investigating. Review the priority queue below."}</div>
        </div>
        <span className="small"><strong>{repos[0] ? `${repos[0].owner}/${repos[0].repo}` : "No repo connected"}</strong><br /><span className="muted">main</span></span>
        <span className="small"><span className="env-dot" style={{ display: "inline-block", marginRight: 6 }} />Production</span>
        <span className="small muted">Last check: {lastSweep ? when(lastSweep.at) : "never"} <span className="spark">╱╲╱╲</span></span>
      </div>

      <GetStarted hasRepo={repos.length > 0} hasTicket={tickets.length > 0} hasRun={runs.length > 0} />

      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb red"><Icon name="alert" size={20} /></span><div><div className="stat-num">{openIncidents.length}</div><div className="stat-label">Open incidents</div></div><span className="spacer" /><span className="delta-up">{openIncidents.length ? "↑ open" : ""}</span></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="layers" size={20} /></span><div><div className="stat-num">{activeRuns}</div><div className="stat-label">Active investigations</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="clock" size={20} /></span><div><div className="stat-num">{pendingApprovals}</div><div className="stat-label">Pending approvals</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{verified7d}</div><div className="stat-label">Verified fixes (7d)</div></div></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
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

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}><div className="card-title" style={{ margin: 0 }}>Recent agent activity</div><Link href="/tickets" className="small">View all runs →</Link></div>
        <p className="muted small">Latest actions taken by Charie and your agents.</p>
        {runs.length === 0 ? <p className="muted small">No runs yet.</p> : (
          <div className="activity-rail">
            {runs.slice(0, 5).map((r) => (
              <div key={r.id} className="activity-node">
                <span className={`icon-orb ${r.status === "done" ? "green" : r.status === "failed" ? "red" : "violet"}`}><Icon name={r.kind === "verify" ? "flask" : "code"} size={20} /></span>
                <div><strong className="small">{r.kind === "verify" ? "Verification run" : "Investigation"} {r.status}</strong><br /><span className="small muted">{r.id.slice(0, 18)} · {r.targetUrl.replace(/^https?:\/\//, "").slice(0, 22)}</span><br /><span className="small muted">{when(r.createdAt)}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
