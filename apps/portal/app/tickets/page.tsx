import Link from "next/link";
import { store } from "@/lib/store";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const tickets = await store.listTickets();
  const open = tickets.filter((t) => t.status !== "closed" && t.status !== "verified").length;
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/tickets", "Tickets and fixes"]]}
        title={<>Tickets and fixes <span className="small muted">{open} open</span></>}
        sub="Every issue from customer report to verified fix. Open one to run the investigation, read findings, and approve fixes."
      />
      <div className="card">
        {tickets.length === 0 ? (
          <EmptyState title="No tickets yet" body="File one from Home - e.g. Checkout button does nothing." />
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
