import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { NewTicketForm } from "@/components/forms";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const myUid = scopeUid(await identity());
  const tickets = await store.listTickets(myUid);
  const defaultTarget = (await store.getSetting("defaultTargetUrl").catch(() => null)) ?? "";
  const open = tickets.filter((t) => t.status !== "closed" && t.status !== "verified").length;
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/tickets", "Tickets and fixes"]]}
        title={<>Tickets and fixes <span className="small muted">{open} open</span></>}
        sub="Every issue from customer report to verified fix. Open one to watch the investigation, read findings, and approve fixes."
      />
      <div className="card" id="new">
        <div className="card-title">File a ticket</div>
        <p className="muted small">
          Describe the customer problem (or hold the mic and talk). A room opens immediately and the investigation starts by itself.
        </p>
        <NewTicketForm defaultTarget={defaultTarget} />
      </div>
      <div className="card">
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
