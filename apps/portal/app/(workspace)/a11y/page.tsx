import Link from "next/link";
import { listA11yReports } from "@/lib/guardian";
import { DEMO_TARGET_NAME, DEMO_TARGET_URL, isDemoAccount } from "@/lib/demo-samples";
import { identity, scopeUid } from "@/lib/who";
import { A11yRunForm, ExecutorTip } from "@/components/scans";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function A11yPage() {
  const uid = scopeUid(await identity());
  const demo = isDemoAccount(uid);
  const reports = await listA11yReports(uid);
  const latest = reports.at(-1);
  const failed = latest?.checks.filter((c) => !c.pass) ?? [];
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/a11y", "Accessibility"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="access" size={19} /></span> Accessibility</>}
        sub="Eight checks against your live page in a real browser: alt text, form labels, button names, headings, language, keyboard reach, text contrast."
        actions={<Link className="btn secondary" href="/reports">All reports</Link>}
      />
      {demo && (
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <div className="card-title">Sample target ready</div>
          <p className="small muted" style={{ margin: 0 }}>Scans in this demo run against the <strong>{DEMO_TARGET_NAME}</strong> at <code>{DEMO_TARGET_URL}</code> (start it with <code>npm run demo:target</code>). The form on the right is prefilled with it - press run and the scan executes live against those intentional bugs.</p>
        </div>
      )}
      {latest && <ExecutorTip executor={latest.executor} target={latest.targetUrl} />}
      {latest && (
        <div className="stats">
          <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="access" size={20} /></span><div><div className="stat-num">{latest.grade}</div><div className="stat-label">Latest grade</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{latest.passed}/{latest.checks.length}</div><div className="stat-label">Checks passed</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb red"><Icon name="alert" size={20} /></span><div><div className="stat-num">{failed.length}</div><div className="stat-label">Open issues</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="layers" size={20} /></span><div><div className="stat-num">{reports.length}</div><div className="stat-label">Scans run</div></div></div></div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div>
          {latest && (
            <div className="card">
              <div className="card-title">Latest scan checks</div>
            <p className="small" style={{ margin: "0 0 8px" }}>{latest.failed === 0 ? `Good news: everything passed (${latest.passed}/${latest.checks.length}, grade ${latest.grade}).` : `${latest.failed} thing(s) to fix below - each check names what is wrong and what to change. Grade ${latest.grade}.`}</p>
              <p className="small muted"><code>{latest.targetUrl}</code> · {latest.at.slice(0, 16).replace("T", " ")}</p>
              <table>
                <thead><tr><th>Check</th><th>Result</th><th>Evidence</th></tr></thead>
                <tbody>
                  {latest.checks.map((c) => (
                    <tr key={c.id}>
                      <td className="small"><strong>{c.name}</strong><br /><span className="muted">{c.id}</span></td>
                      <td><span className={c.pass ? "proof-pass" : "proof-fail"}>{c.pass ? "Passed" : "Failed"}</span></td>
                      <td className="small">{c.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="card">
            <div className="card-title">Scan history ({reports.length})</div>
            {reports.length === 0 ? (
              <EmptyState title="No scans yet" body="Run one on the right against any public URL." />
            ) : (
              <table>
                <thead><tr><th>Grade</th><th>Target</th><th>Passed</th><th>When</th><th></th></tr></thead>
                <tbody>
                  {[...reports].reverse().map((r) => (
                    <tr key={r.id}>
                      <td><Badge tone={`grade-${r.grade}`}>{r.grade}</Badge></td>
                      <td className="small"><code>{r.targetUrl}</code></td>
                      <td className="small">{r.passed}/{r.checks.length}</td>
                      <td className="small muted">{r.at.slice(0, 16).replace("T", " ")}</td>
                      <td className="small"><Link href={`/reports/a11y/${r.id}`}>Report</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><span className="icon-orb violet"><Icon name="play" /></span> New scan</div>
          <p className="small muted">Runs in a real browser against the live page. Results save to your account.</p>
          <A11yRunForm defaultTarget={demo ? DEMO_TARGET_URL : ""} />
        </div>
      </div>
    </>
  );
}
