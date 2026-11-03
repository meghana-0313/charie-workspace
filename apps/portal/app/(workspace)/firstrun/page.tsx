import Link from "next/link";
import { listFirstRunReports } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";
import { FirstRunForm } from "@/components/scans";
import { Icon } from "@/components/icons";
import { EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FirstRunPage() {
  const reports = await listFirstRunReports(scopeUid(await identity()));
  const latest = reports.at(-1);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/firstrun", "First run"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="play" size={19} /></span> First run</>}
        sub="See your product the way a new user does: load speed, headline clarity, one clear next step, console health, mobile layout, sign in reach."
        actions={<Link className="btn secondary" href="/reports">All reports</Link>}
      />
      {latest && (
        <div className="stats">
          <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="spark" size={20} /></span><div><div className="stat-num">{latest.score}/100</div><div className="stat-label">Latest score</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{latest.passed}/{latest.steps.length}</div><div className="stat-label">Steps passed</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb red"><Icon name="alert" size={20} /></span><div><div className="stat-num">{latest.failed}</div><div className="stat-label">Steps failed</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="layers" size={20} /></span><div><div className="stat-num">{reports.length}</div><div className="stat-label">Tests run</div></div></div></div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div>
          {latest && (
            <div className="card">
              <div className="card-title">Latest test steps</div>
            <p className="small" style={{ margin: "0 0 8px" }}>{latest.failed === 0 ? `A new user gets through cleanly (score ${latest.score}/100).` : `A new user hits ${latest.failed} snag(s) below - start with the first failed step. Score ${latest.score}/100.`}</p>
              <p className="small muted"><code>{latest.targetUrl}</code> · {latest.at.slice(0, 16).replace("T", " ")}</p>
              <div className="progress" style={{ marginBottom: 12 }}><i style={{ width: `${latest.score}%` }} /></div>
              <table>
                <thead><tr><th>Step</th><th>Result</th><th>Evidence</th></tr></thead>
                <tbody>
                  {latest.steps.map((s) => (
                    <tr key={s.id}>
                      <td className="small"><strong>{s.name}</strong></td>
                      <td><span className={s.pass ? "proof-pass" : "proof-fail"}>{s.pass ? "Passed" : "Failed"}</span></td>
                      <td className="small">{s.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="card">
            <div className="card-title">Test history ({reports.length})</div>
            {reports.length === 0 ? (
              <EmptyState title="No tests yet" body="Run one on the right against any public URL." />
            ) : (
              <table>
                <thead><tr><th>Score</th><th>Target</th><th>Passed</th><th>When</th><th></th></tr></thead>
                <tbody>
                  {[...reports].reverse().map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.score}/100</strong></td>
                      <td className="small"><code>{r.targetUrl}</code></td>
                      <td className="small">{r.passed}/{r.steps.length}</td>
                      <td className="small muted">{r.at.slice(0, 16).replace("T", " ")}</td>
                      <td className="small"><Link href={`/reports/firstrun/${r.id}`}>Report</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><span className="icon-orb violet"><Icon name="play" /></span> New test</div>
          <p className="small muted">Opens the page like a first time visitor and grades the first sixty seconds.</p>
          <FirstRunForm />
        </div>
      </div>
    </>
  );
}
