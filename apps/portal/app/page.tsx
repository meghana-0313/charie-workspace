import Link from "next/link";
import { store } from "@/lib/store";
import { NewTicketForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const tickets = await store.listTickets();
  const runs = await store.listRuns(10);
  return (
    <>
      <div className="panel">
        <h2>New ticket</h2>
        <p className="muted small">
          Describe the customer problem. A room opens immediately; run the investigation from the ticket page.
          Voice notes are stored as-is - transcription wires up in M4.
        </p>
        <NewTicketForm />
      </div>
      <div className="panel">
        <h2>Tickets ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <p className="muted">No tickets yet. File one above - e.g. “Checkout button does nothing”.</p>
        ) : (
          <table>
            <thead><tr><th>Subject</th><th>Goal</th><th>Status</th><th>Opened</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/tickets/${t.id}`}>{t.subject}</Link></td>
                  <td className="small muted">{t.goal}</td>
                  <td><span className="pill">{t.status}</span></td>
                  <td className="small muted">{t.createdAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="panel">
        <h2>Recent engine runs ({runs.length})</h2>
        <p className="muted small">Latest investigations and verifications across all tickets.</p>
        <p className="small">{runs.length === 0 ? "None yet." : runs.map((r) => `${r.id.slice(0, 19)} (${r.kind}/${r.status})`).join(" · ")}</p>
      </div>
    </>
  );
}
