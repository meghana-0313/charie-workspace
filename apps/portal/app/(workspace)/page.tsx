import Link from "next/link";
import { store } from "@/lib/store";
import { listSweeps } from "@/lib/guardian";
import { NewTicketForm } from "@/components/forms";
import { Badge, EmptyState, PageHead, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const tickets = await store.listTickets();
  const runs = await store.listRuns(8);
  const incidents = await store.listIncidents();
  const sweeps = await listSweeps();
  const openTickets = tickets.filter((t) => t.status !== "closed" && t.status !== "verified").length;
  const openIncidents = incidents.filter((i) => i.status === "open").length;
  const lastSweep = sweeps.at(-1);

  return (
    <>
      <PageHead
        title="Meet CHARIE"
        sub="Your software's autonomous companion. Charie Build tests your product, Charie Guard answers threats, Charie Ops watches production. Start below."
      />
      {tickets.length === 0 && runs.length === 0 && (
        <div className="card">
          <div className="card-title">First time here? Three steps</div>
          <ol className="onboard">
            <li><span className="step">1</span><span><Link href="/repos"><strong>Test a repo</strong></Link>. Connect GitHub; Charie builds, deploys, and files the first ticket itself.</span></li>
            <li><span className="step">2</span><span><a href="#new-ticket"><strong>File a ticket</strong></a>. Describe a customer problem, or run an <Link href="/a11y">accessibility scan</Link> or <Link href="/firstrun">first run test</Link> on any URL.</span></li>
            <li><span className="step">3</span><span><strong>Approve the fix</strong>. Open the ticket, run the investigation, approve findings in <Link href="/guardian/work">Fix tasks</Link>.</span></li>
          </ol>
        </div>
      )}
      <div className="stats">
        <Stat num={openTickets} label="open tickets" />
        <Stat num={runs.length} label="recent engine runs" />
        <Stat num={openIncidents} label="open incidents" />
        <Stat
          num={lastSweep ? (lastSweep.pass ? "PASS" : "FAIL") : "-"}
          label={lastSweep ? `last sweep ${lastSweep.at.slice(5, 16).replace("T", " ")}` : "no sweeps yet"}
        />
      </div>

      <div className="grid2">
        <div className="card" id="new-ticket">
          <div className="card-title">New ticket</div>
          <p className="muted small">
            Describe the customer problem. A room opens immediately; run the investigation from the ticket page.
          </p>
          <NewTicketForm />
        </div>
        <div className="card">
          <div className="card-title">Recent engine runs</div>
          {runs.length === 0 ? (
            <EmptyState title="No runs yet" body="Runs appear here after the first investigation." />
          ) : (
            <table>
              <thead><tr><th>Run</th><th>Kind</th><th>Status</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="mono"><Link href={`/tickets/${r.ticketId}`}>{r.id.slice(0, 19)}</Link></td>
                    <td><Badge>{r.kind}</Badge></td>
                    <td><Badge tone={r.status}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Tickets ({tickets.length})</div>
        {tickets.length === 0 ? (
          <EmptyState title="No tickets yet" body="File one above - e.g. Checkout button does nothing." />
        ) : (
          <table>
            <thead><tr><th>Subject</th><th>Goal</th><th>Status</th><th>Opened</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/tickets/${t.id}`}>{t.subject}</Link></td>
                  <td className="small muted">{t.goal}</td>
                  <td><Badge tone={t.status}>{t.status}</Badge></td>
                  <td className="small muted">{t.createdAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
