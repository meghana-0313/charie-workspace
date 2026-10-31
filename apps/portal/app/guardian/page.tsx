import Link from "next/link";
import { store } from "@/lib/store";
import { AnalyzeButton, SeedButton } from "@/components/guardian-forms";

export const dynamic = "force-dynamic";

export default async function GuardianPage() {
  const incidents = await store.listIncidents();
  const events = await store.listRecentEvents(1);
  return (
    <>
      <p><Link href="/">← Dashboard</Link></p>
      <div className="panel">
        <h2>Runtime Guardian <span className="pill">simulated environment</span></h2>
        <p className="muted small">
          Post-deploy threat monitoring. Events stream in through the webhook
          (<code>/api/guardian/events</code>), detectors flag attack patterns, Meta models
          investigate, and approved responses execute against a simulation - never real prod.
        </p>
        <div className="row">
          <SeedButton />
          <AnalyzeButton />
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          {events.length === 0
            ? "No events yet. Press Simulate attack, then Analyze now."
            : `${incidents.length} incident(s) on record. Newest first.`}
        </p>
      </div>
      <div className="panel">
        <h2>Incidents ({incidents.length})</h2>
        {incidents.length === 0 ? (
          <p className="muted">None yet. Simulate the credential-stuffing attack above to see the full loop.</p>
        ) : (
          <table>
            <thead><tr><th>Title</th><th>Severity</th><th>Status</th><th>Mode</th><th>Opened</th></tr></thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/guardian/${i.id}`}>{i.title}</Link></td>
                  <td><span className="pill">{i.severity}</span></td>
                  <td><span className="pill">{i.status}</span></td>
                  <td className="small muted">{i.mode}</td>
                  <td className="small muted">{i.createdAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
