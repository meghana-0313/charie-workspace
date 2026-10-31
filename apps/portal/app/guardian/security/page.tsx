import Link from "next/link";
import { listPentestReports } from "@/lib/guardian";
import { SuiteNav } from "@/components/suite-nav";
import { PentestButton, ProposeWorkOrderButton } from "@/components/suite";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const reports = await listPentestReports();
  const latest = reports.at(-1);
  return (
    <>
      <p><Link href="/guardian">← Guardian</Link></p>
      <SuiteNav current="/guardian/security" />
      <div className="panel">
        <h2>Appendix B pen-test suite</h2>
        <p className="muted small">
          Eleven automated checks against the live portal + engine: auth gate, security headers, TLS
          upgrade, token smuggling, path traversal, CORS, error leakage, SSRF guard, cookie flags,
          health, and TLS posture (protocol, cipher, cert expiry). Runs on demand here and nightly
          inside Night Shift.
        </p>
        <PentestButton />
      </div>
      {!latest ? (
        <div className="panel"><p className="muted">No scans yet. Run the suite to grade the deployment.</p></div>
      ) : (
        <div className="panel">
          <h2>
            Latest scan <span className={`pill grade-${latest.grade}`}>grade {latest.grade}</span>{" "}
            <span className="pill">{latest.passed}/{latest.checks.length} pass</span>
          </h2>
          <p className="small muted">
            {latest.at.slice(0, 16).replace("T", " ")} · targets {latest.targets.join(", ")}
          </p>
          <table>
            <thead><tr><th>Check</th><th>Severity</th><th>Result</th><th>Evidence</th><th></th></tr></thead>
            <tbody>
              {latest.checks.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}<br /><span className="small muted"><code>{c.id}</code></span></td>
                  <td><span className="pill">{c.severity}</span></td>
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
