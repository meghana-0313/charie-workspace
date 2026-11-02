import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { listDigests, listSweeps } from "@/lib/guardian";
import { GetStarted } from "@/components/onboard";
import { Badge, EmptyState, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return iso.slice(5, 16).replace("T", " ");
}

export default async function Dashboard() {
  const id = await identity();
  const myUid = scopeUid(id);
  const [tickets, runs, incidents, repos, sweeps, schedules, digests] = await Promise.all([
    store.listTickets(myUid),
    store.listRuns(8, myUid),
    store.listIncidents(myUid),
    store.listRepos(myUid),
    listSweeps(myUid),
    store.listSchedules(myUid).catch(() => []),
    listDigests(myUid),
  ]);
  const open = tickets.filter((t) => t.status !== "closed" && t.status !== "verified");
  const openIncidents = incidents.filter((i) => i.status === "open");
  const lastSweep = sweeps.at(-1);
  const lastDigest = digests.at(-1);
  const activeSchedules = schedules.filter((s) => s.enabled).length;
  const firstName = (id?.name ?? id?.email ?? "").split(/[\s@]/)[0];

  return (
    <>
      <section className="hero">
        <div className="hero-status">
          <Badge tone={openIncidents.length > 0 ? "major" : "minor"}>
            {openIncidents.length > 0 ? `${openIncidents.length} open incident(s)` : "No open incidents"}
          </Badge>
          <Badge tone={lastSweep?.pass ? "minor" : undefined}>
            {lastSweep ? `Last sweep ${lastSweep.pass ? "passed" : "failed"} ${when(lastSweep.at)}` : "No sweeps yet"}
          </Badge>
          <Badge>{activeSchedules} autopilot schedule(s) on</Badge>
          {lastDigest && <Badge tone="info">Night shift digest ready</Badge>}
        </div>
        <h1 className="hero-title">{firstName ? `Welcome back, ${firstName}.` : "Meet Charie."}</h1>
        <p className="hero-sub">
          Your software's autonomous companion. File a problem and Charie investigates it,
          proves the fix, and keeps watch while you sleep. Ticket to evidence to fix to proof.
        </p>
        <div className="hero-actions">
          <Link href="/tickets" className="btn">File a ticket</Link>
          <Link href="/chat" className="btn secondary">Chat with Charie</Link>
          <Link href="/repos" className="btn secondary">Test a repo</Link>
          <Link href="/guardian/zoom" className="btn secondary">Start a call</Link>
        </div>
      </section>

      <GetStarted hasRepo={repos.length > 0} hasTicket={tickets.length > 0} hasRun={runs.length > 0} />

      <div className="stats">
        <Stat num={open.length} label="open tickets" />
        <Stat num={runs.length} label="recent engine runs" />
        <Stat num={openIncidents.length} label="open incidents" />
        <Stat num={repos.length} label="connected repos" />
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-title">Needs your attention</div>
          {open.length === 0 && openIncidents.length === 0 ? (
            <EmptyState title="All clear" body="No open tickets or incidents. File a ticket when a customer hits a wall." />
          ) : (
            <ul className="feed">
              {openIncidents.slice(0, 3).map((i) => (
                <li key={i.id}>
                  <span className="when">{when(i.createdAt)}</span>
                  <span className="what">
                    <Badge tone="major">incident</Badge>{" "}
                    <Link href={`/guardian/${i.id}`}>{i.title}</Link>
                  </span>
                </li>
              ))}
              {open.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <span className="when">{when(t.createdAt)}</span>
                  <span className="what">
                    <Link href={`/tickets/${t.id}`}>{t.subject}</Link>{" "}
                    <Badge tone={t.status}>{t.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-title">Latest engine runs</div>
          {runs.length === 0 ? (
            <EmptyState title="No runs yet" body="Runs appear here after the first investigation." />
          ) : (
            <ul className="feed">
              {runs.map((r) => (
                <li key={r.id}>
                  <span className="when">{when(r.createdAt)}</span>
                  <span className="what">
                    <Link href={`/tickets/${r.ticketId}`}>{r.kind} run</Link>{" "}
                    <Badge tone={r.status}>{r.status}</Badge>{" "}
                    <span className="small muted">{r.targetUrl.replace(/^https?:\/\//, "").slice(0, 34)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid3">
        <div className="card family-card">
          <div className="family-name">Charie Build</div>
          <p className="small muted">Quality before release. Tickets become investigations with evidence, fixes, and verified proof.</p>
          <Link href="/tickets" className="btn secondary sm">Open tickets</Link>
        </div>
        <div className="card family-card">
          <div className="family-name">Charie Guard</div>
          <p className="small muted">Threats answered while you sleep. Sweeps, a 35-check pentest, incidents, and the overnight shift.</p>
          <Link href="/guardian" className="btn secondary sm">Open incidents</Link>
        </div>
        <div className="card family-card">
          <div className="family-name">Charie Ops</div>
          <p className="small muted">Production that files its own tickets. Live signals, log watch, autopilot schedules, and support calls.</p>
          <Link href="/autopilot" className="btn secondary sm">Open autopilot</Link>
        </div>
      </div>
    </>
  );
}
