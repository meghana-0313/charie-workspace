import { listA11yReports } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";
import { A11yRunForm } from "@/components/scans";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function A11yPage() {
  const reports = await listA11yReports(scopeUid(await identity()));
  const latest = reports.at(-1);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/a11y", "Accessibility"]]}
        title={<>Accessibility {latest && <Badge tone={`grade-${latest.grade}`}>grade {latest.grade}</Badge>}</>}
        sub="Eight checks against your live page in a real browser: alt text, form labels, button names, headings, language, keyboard reach, text contrast."
      />
      <div className="card">
        <div className="card-title">New scan</div>
        <A11yRunForm />
      </div>
      <div className="card">
        <div className="card-title">Recent scans ({reports.length})</div>
        {reports.length === 0 ? (
          <EmptyState title="No scans yet" body="Run one above against any public URL." />
        ) : (
          <table>
            <thead><tr><th>Grade</th><th>Target</th><th>Passed</th><th>When</th></tr></thead>
            <tbody>
              {[...reports].reverse().map((r) => (
                <tr key={r.id}>
                  <td><Badge tone={`grade-${r.grade}`}>{r.grade}</Badge></td>
                  <td className="small"><code>{r.targetUrl}</code></td>
                  <td className="small">{r.passed}/{r.checks.length}</td>
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
