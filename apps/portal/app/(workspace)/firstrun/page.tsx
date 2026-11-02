import { listFirstRunReports } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";
import { FirstRunForm } from "@/components/scans";
import { EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FirstRunPage() {
  const reports = await listFirstRunReports(scopeUid(await identity()));
  const latest = reports.at(-1);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/firstrun", "First run"]]}
        title={<>First run {latest && <span className="small muted">latest score {latest.score}/100</span>}</>}
        sub="See your product the way a new user does: load speed, headline clarity, one clear next step, console health, mobile layout, sign in reach."
      />
      <div className="card">
        <div className="card-title">New test</div>
        <FirstRunForm />
      </div>
      <div className="card">
        <div className="card-title">Recent tests ({reports.length})</div>
        {reports.length === 0 ? (
          <EmptyState title="No tests yet" body="Run one above against any public URL." />
        ) : (
          <table>
            <thead><tr><th>Score</th><th>Target</th><th>Passed</th><th>When</th></tr></thead>
            <tbody>
              {[...reports].reverse().map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.score}/100</strong></td>
                  <td className="small"><code>{r.targetUrl}</code></td>
                  <td className="small">{r.passed}/{r.steps.length}</td>
                  <td className="small muted">{r.at.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
