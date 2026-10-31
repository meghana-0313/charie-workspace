import Link from "next/link";
import { store } from "@/lib/store";
import { listSweeps } from "@/lib/guardian";
import { AnalyzeButton, SeedButton } from "@/components/guardian-forms";
import { PushButton, SweepButton, UploadLogsForm } from "@/components/suite";
import { Badge, EmptyState, PageHead, Stat } from "@/components/ui";

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
  const open = incidents.filter((i) => i.status === "open").length;

  return (
    <>
      <PageHead
        crumbs={[["/", "Overview"], ["/guardian", "Guardian"]]}
        title={<>Runtime Guardian <Badge>simulated environment</Badge></>}
        sub="Post-deploy threat monitoring. Events stream in through the webhook (/api/guardian/events), detectors flag attack patterns, Meta models investigate, and approved responses execute against a simulation, never real prod."
        actions={<><SeedButton /><AnalyzeButton /><SweepButton /><PushButton /></>}
      />

      <div className="stats">
        <Stat num={open} label="open incidents" />
        <Stat num={incidents.length} label="total incidents" />
        <Stat num={streak} label="pass sweep streak" />
        <Stat num={lastSweepState(last)} label="last sweep" />
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-title">Continuous monitoring</div>
          {!last ? (
            <EmptyState
              title="No sweeps yet"
              body="The hourly scheduler heartbeat posts to the engine sweep endpoint. Press Sweep now to run one on demand."
            />
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
                <p className="small muted">History: {sweeps.slice(-12).map((s) => (s.pass ? "●" : "○")).join(" ")} (newest last)</p>
              )}
            </>
          )}
        </div>
        <div className="card">
          <div className="card-title">Ingest events</div>
          <p className="muted small">
            {events.length === 0
              ? "No events yet. Simulate an attack or upload a log file, then Analyze now."
              : `${incidents.length} incident(s) on record. Newest first.`}
          </p>
          <UploadLogsForm />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Incidents ({incidents.length})</div>
        {incidents.length === 0 ? (
          <EmptyState title="No incidents" body="Simulate the credential-stuffing attack above to see the full loop." />
        ) : (
          <table>
            <thead><tr><th>Title</th><th>Severity</th><th>Status</th><th>Mode</th><th>Opened</th></tr></thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/guardian/${i.id}`}>{i.title}</Link></td>
                  <td><Badge tone={i.severity}>{i.severity}</Badge></td>
                  <td><Badge tone={i.status}>{i.status}</Badge></td>
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

function lastSweepState(last: { pass: boolean } | undefined): string {
  if (!last) return "-";
  return last.pass ? "PASS" : "FAIL";
}
