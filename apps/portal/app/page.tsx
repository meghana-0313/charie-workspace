import Link from "next/link";
import { store } from "@/lib/store";
import { listReportDirs } from "@/lib/engine";
import { NewTicketForm } from "@/components/forms";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const tickets = store.listTickets();
  const reportDirs = listReportDirs();
  return (
    <>
      <div className="panel">
        <h2>New ticket</h2>
        <p className="muted small">
          Describe the customer problem. A room opens immediately; run the investigation from the ticket page.
          Voice notes are stored as-is — transcription wires up in M4.
        </p>
        <NewTicketForm />
      </div>
      <div className="panel">
        <h2>Tickets ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <p className="muted">No tickets yet. File one above — e.g. “Checkout button does nothing”.</p>
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
        <h2>Engine runs on disk ({reportDirs.length})</h2>
        <p className="muted small">
          Raw report directories from <code>services/agent-engine/reports</code>, including CLI runs.
        </p>
        <p className="small">{reportDirs.length === 0 ? "None yet." : reportDirs.join(" · ")}</p>
      </div>
    </>
  );
}
