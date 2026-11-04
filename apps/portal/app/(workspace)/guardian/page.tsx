import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { lastLogWatch, listSweeps } from "@/lib/guardian";
import { LogWatchPanel } from "@/components/logwatch";
import { AnalyzeButton, SeedButton } from "@/components/guardian-forms";
import { PushButton, SweepButton, UploadLogsForm } from "@/components/suite";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

function sevClass(s: string): string {
  return s === "blocker" || s === "critical" ? "critical" : s === "major" || s === "high" ? "high" : s === "medium" ? "medium" : "low";
}

export default async function GuardianPage() {
  const myUid = scopeUid(await identity());
  const incidents = await store.listIncidents(myUid);
  const events = await store.listRecentEvents(1, myUid);
  const sweeps = await listSweeps(myUid);
  let streak = 0;
  for (let i = sweeps.length - 1; i >= 0; i--) {
    if (sweeps[i].pass) streak++;
    else break;
  }
  const last = sweeps.at(-1);
  const open = incidents.filter((i) => i.status === "open").length;
  const contained = incidents.filter((i) => i.status === "contained").length;
  const focal = incidents[0];
  const prodProject = await store.getSetting("prodProjectId").catch(() => null);
  const logReport = await lastLogWatch(myUid).catch(() => null);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian", "Incidents"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="shield" size={19} /></span> Incidents <Badge>simulated environment</Badge></>}
        sub="Charie Guard watches production after every deploy. Detectors flag attack patterns, Meta models investigate, and approved responses execute against a simulation, never real prod."
        actions={<><Link className="btn secondary" href="/reports">All reports</Link><SeedButton /><AnalyzeButton /><SweepButton /><PushButton /></>}
      />

      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb red"><Icon name="alert" size={20} /></span><div><div className="stat-num">{open}</div><div className="stat-label">Open incidents</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="shield" size={20} /></span><div><div className="stat-num">{contained}</div><div className="stat-label">Contained</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{streak}</div><div className="stat-label">Pass sweep streak</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="signal" size={20} /></span><div><div className="stat-num">{last ? (last.pass ? "PASS" : "FAIL") : "-"}</div><div className="stat-label">Last sweep</div></div></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div>
          <div className="card">
            <div className="card-title">Detections ({incidents.length})</div>
            {incidents.length === 0 ? (
              <EmptyState title="No incidents" body="Simulate the credential stuffing attack above to see the full loop." />
            ) : (
              <table>
                <thead><tr><th>Threat</th><th>Severity</th><th>Status</th><th>Mode</th><th>Opened</th><th></th></tr></thead>
                <tbody>
                  {incidents.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/guardian/${i.id}`}><strong className="small">{i.title}</strong></Link><br /><span className="small muted">{i.signals.length} signal(s)</span></td>
                      <td><span className={`sev ${sevClass(i.severity)}`}>{i.severity}</span></td>
                      <td><Badge tone={i.status}>{i.status}</Badge></td>
                      <td className="small muted">{i.mode}</td>
                      <td className="small muted">{i.createdAt.slice(0, 16).replace("T", " ")}</td>
                      <td><span className="row" style={{ flexWrap: "nowrap" }}><Link className="small" href={`/reports/incident/${i.id}`}>Report</Link><Link href={`/guardian/${i.id}`} aria-label={`Open ${i.title}`}><Icon name="arrow" /></Link></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-title">Continuous monitoring</div>
            {!last ? (
              <EmptyState title="No sweeps yet" body="The hourly scheduler heartbeat posts to the engine sweep endpoint. Press Sweep now to run one on demand." />
            ) : (
              <>
                <p className="small">Last sweep {last.at.slice(0, 16).replace("T", " ")}: <span className={last.pass ? "proof-pass" : "proof-fail"}>{last.pass ? "PASS" : "FAIL"}</span></p>
                <ul className="small">
                  {last.checks.map((c) => (
                    <li key={c.name}><span className={c.pass ? "proof-pass" : "proof-fail"}>{c.pass ? "PASS" : "FAIL"}</span> {c.name}: {c.evidence}</li>
                  ))}
                </ul>
                {sweeps.length > 1 && <p className="small muted">History: {sweeps.slice(-12).map((s) => (s.pass ? "●" : "○")).join(" ")} (newest last)</p>}
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">Production connection</div>
            <p className="muted small">
              Point Charie at your Google Cloud project and it reads live errors itself. Same project works out of the box; for another project, grant the runtime service account <code>roles/logging.viewer</code> there first.
            </p>
            <LogWatchPanel initialProject={prodProject} initialReport={logReport} />
          </div>
        </div>

        <div>
          {focal && (
            <div className="card">
              <div className="card-title">Latest detection</div>
              <p><span className={`sev ${sevClass(focal.severity)}`}>{focal.severity}</span> <Badge tone={focal.status}>{focal.status}</Badge></p>
              <p><strong className="small">{focal.title}</strong></p>
              {focal.investigation ? (
                <>
                  <p className="small"><strong>Verdict:</strong> {focal.investigation.verdict}</p>
                  <p className="small muted">{focal.investigation.summary}</p>
                </>
              ) : (
                <p className="small muted">Signals only, no AI investigation yet.</p>
              )}
              <ul className="small">
                {focal.signals.slice(0, 4).map((s, i) => <li key={i}>{s.title}</li>)}
              </ul>
              <p style={{ marginTop: 10 }}><Link className="btn" href={`/guardian/${focal.id}`}>Open investigation <Icon name="arrow" /></Link></p>
            </div>
          )}
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
      </div>
    </>
  );
}
