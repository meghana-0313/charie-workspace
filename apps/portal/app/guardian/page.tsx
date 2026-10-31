import Link from "next/link";
import { store } from "@/lib/store";
import { listSweeps } from "@/lib/guardian";
import { AnalyzeButton, SeedButton } from "@/components/guardian-forms";
import { PushButton, SweepButton, UploadLogsForm } from "@/components/suite";
import { SuiteNav } from "@/components/suite-nav";

export const dynamic = "force-dynamic";

export default async function GuardianPage() {
  const incidents = await store.listIncidents();
  const events = await store.listRecentEvents(1);
  const sweeps = await listSweeps();
  let streak = 0;
  for (let i = sweeps.length - 1; i >= 0; i--) {
    if (sweeps[i].pass) streak++;
    else break;
  }
  const last = sweeps.at(-1);
  return (
    <>
      <p><Link href="/">← Dashboard</Link></p>
      <SuiteNav current="/guardian" />
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
          <SweepButton />
          <PushButton />
        </div>
        <div style={{ marginTop: 10 }}><UploadLogsForm /></div>
        <p className="small muted" style={{ marginTop: 8 }}>
          {events.length === 0
            ? "No events yet. Simulate an attack, upload a log file, then Analyze now."
            : `${incidents.length} incident(s) on record. Newest first.`}
        </p>
      </div>
      <div className="panel">
        <h2>Continuous monitoring {sweeps.length > 0 && <span className="pill">{streak} sweep streak</span>}</h2>
        {!last ? (
          <p className="muted small">
            No sweeps yet. The hourly Cloud Scheduler heartbeat POSTs to the engine sweep endpoint;
            press Sweep now to run one on demand.
          </p>
        ) : (
          <>
            <p className="small">
              Last sweep {last.at.slice(0, 16).replace("T", " ")}:{" "}
              <span className={last.pass ? "proof-pass" : "proof-fail"}>{last.pass ? "PASS" : "FAIL"}</span>
            </p>
            <ul className="small">
              {last.checks.map((c) => (
                <li key={c.name}><span className={c.pass ? "proof-pass" : "proof-fail"}>{c.pass ? "PASS" : "FAIL"}</span> {c.name}: {c.evidence}</li>
              ))}
            </ul>
            {sweeps.length > 1 && (
              <p className="small muted">
                History: {sweeps.slice(-12).map((s) => (s.pass ? "●" : "○")).join(" ")} (newest last)
              </p>
            )}
          </>
        )}
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
