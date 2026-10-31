import { listPentestReports } from "@/lib/guardian";
import { PentestButton, ProposeWorkOrderButton } from "@/components/suite";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const reports = await listPentestReports();
  const latest = reports.at(-1);
  return (
    <>
      <PageHead
        crumbs={[["/", "Overview"], ["/guardian/security", "Security"]]}
        title="Appendix B pen-test suite"
        sub="Eleven automated checks against the live portal + engine: auth gate, security headers, TLS upgrade, token smuggling, path traversal, CORS, error leakage, SSRF guard, cookie flags, health, and TLS posture. Runs on demand here and nightly inside Night Shift."
        actions={<PentestButton />}
      />
      {!latest ? (
        <div className="card">
          <EmptyState title="No scans yet" body="Run the suite to grade the deployment." />
        </div>
      ) : (
        <div className="card">
          <div className="card-title">
            Latest scan <Badge tone={`grade-${latest.grade}`}>grade {latest.grade}</Badge>{" "}
            <Badge>{latest.passed}/{latest.checks.length} pass</Badge>
          </div>
          <p className="small muted">
            {latest.at.slice(0, 16).replace("T", " ")} · targets {latest.targets.join(", ")}
          </p>
          <table>
            <thead><tr><th>Check</th><th>Severity</th><th>Result</th><th>Evidence</th><th></th></tr></thead>
            <tbody>
              {latest.checks.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}<br /><span className="small muted"><code>{c.id}</code></span></td>
                  <td><Badge tone={c.severity}>{c.severity}</Badge></td>
                  <td><span className={c.pass ? "proof-pass" : "proof-fail"}>{c.pass ? "PASS" : "FAIL"}</span></td>
                  <td className="small">{c.evidence}</td>
                  <td>
                    {!c.pass && (
                      <ProposeWorkOrderButton
                        title={`Fix pen-test check: ${c.name}`}
                        source="pentest"
                        sourceRef={c.id}
                        plan={[
                          { kind: "re-analyze", label: `Re-run check ${c.id} after fix`, ref: c.id },
                          { kind: "evidence-pack", label: "Assemble evidence pack", ref: c.id },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
