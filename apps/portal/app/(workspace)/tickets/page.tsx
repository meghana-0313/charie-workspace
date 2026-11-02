import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { NewTicketForm } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const myUid = scopeUid(await identity());
  const tickets = await store.listTickets(myUid);
  const defaultTarget = (await store.getSetting("defaultTargetUrl").catch(() => null)) ?? "";
  const open = tickets.filter((t) => t.status !== "closed" && t.status !== "verified").length;
  const verified = tickets.filter((t) => t.status === "verified").length;
  const active = tickets.filter((t) => ["investigating", "fixing", "verifying"].includes(t.status)).length;
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/tickets", "Tickets and fixes"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="ticket" size={19} /></span> Tickets and fixes</>}
        sub="Every issue from customer report to verified fix. Open one to watch the investigation, read findings, and approve fixes."
      />
      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="ticket" size={20} /></span><div><div className="stat-num">{open}</div><div className="stat-label">Open tickets</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="search" size={20} /></span><div><div className="stat-num">{active}</div><div className="stat-label">Under investigation</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{verified}</div><div className="stat-label">Verified fixes</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="layers" size={20} /></span><div><div className="stat-num">{tickets.length}</div><div className="stat-label">Total tickets</div></div></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div className="card">
          <div className="card-title">All tickets ({tickets.length})</div>
          {tickets.length === 0 ? (
            <EmptyState title="No tickets yet" body="File one on the right. Example: Checkout button does nothing." />
          ) : (
            <table>
              <thead><tr><th>Ticket</th><th>Goal</th><th>Status</th><th>Opened</th><th></th></tr></thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tickets/${t.id}`}><strong className="small">{t.subject}</strong></Link>
                      <br /><span className="small muted"><code>{t.id}</code>{t.sourceRepo ? ` · ${t.sourceRepo}` : ""}</span>
                    </td>
                    <td className="small muted">{t.goal}</td>
                    <td><Badge tone={t.status}>{t.status}</Badge></td>
                    <td className="small muted">{t.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td><Link href={`/tickets/${t.id}`} aria-label={`Open ${t.subject}`}><Icon name="arrow" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card" id="new">
          <div className="card-title"><span className="icon-orb violet"><Icon name="plus" /></span> File a ticket</div>
          <p className="muted small">
            Describe the customer problem, or hold the mic and talk. A room opens immediately and the investigation starts by itself.
          </p>
          <NewTicketForm defaultTarget={defaultTarget} />
        </div>
      </div>
    </>
  );
}
