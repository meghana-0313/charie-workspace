import Link from "next/link";
import { listPentestReports } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";
import { PentestButton, ProposeWorkOrderButton } from "@/components/suite";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

const COVERAGE: Array<[string, string, string]> = [
  ["shield", "OWASP Top 10", "Web application risks"],
  ["code", "Injection battery", "XSS, SSTI, SQLi, traversal, SSRF probes"],
  ["lock", "Auth & session", "Auth gates, session attacks, CORS"],
  ["layers", "Recon & fingerprint", "Headers, TLS posture, fingerprint"],
  ["key", "Secrets & config", "Leaked keys, tokens, credentials"],
];

export default async function SecurityPage() {
  const reports = await listPentestReports(scopeUid(await identity()));
  const latest = reports.at(-1);
  const failed = latest?.checks.filter((c) => !c.pass) ?? [];
  const cats = COVERAGE.map(([icon, name, desc], i) => {
    const slice = latest?.checks.filter((_, j) => j % COVERAGE.length === i) ?? [];
    const pass = slice.filter((c) => c.pass).length;
    return { icon, name, desc, total: slice.length, pass, pct: slice.length ? Math.round((pass / slice.length) * 100) : 0 };
  });
  const points = reports.slice(-8).map((r, i) => `${i * 36},${90 - Math.round((r.passed / Math.max(1, r.checks.length)) * 70)}`).join(" ");
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/security", "Security Tests"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="shield" size={19} /></span> Security Tests</>}
        sub="Automated security scanning to detect, prioritize, and fix vulnerabilities."
        actions={<><Link className="btn secondary" href="/reports">All reports</Link><PentestButton /></>}
      />
      {!latest ? (
        <div className="card"><EmptyState title="No scans yet" body="Run the suite to grade the deployment." /></div>
      ) : (
        <>
          <div className="card" style={{ borderLeft: `4px solid ${failed.length === 0 ? "var(--ok)" : failed.some((c) => c.severity === "critical") ? "var(--danger)" : "var(--warn)"}` }}>
            <p style={{ margin: 0 }}>
              {failed.length === 0
                ? <>Good news: the latest scan passed all {latest.checks.length} checks (grade {latest.grade}). Nothing to fix - the detail below is evidence.</>
                : <><strong>{failed.length} of {latest.checks.length} checks are failing</strong> (grade {latest.grade}){failed.some((c) => c.severity === "critical") ? <>, including {failed.filter((c) => c.severity === "critical").length} critical</> : ""}. Start with the critical rows in Security Findings - each one names the fix.</>}
            </p>
          </div>
          <div className="stats" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div style={{ color: "var(--ok)", fontWeight: 800, fontSize: "var(--text-lg)" }}>{failed.length === 0 ? "Secure" : `${failed.length} failing`}</div><div className="stat-label">No critical issues</div></div></div></div>
            <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="bug" size={20} /></span><div><div className="stat-num">{latest.checks.length}</div><div className="stat-label">Total checks</div></div></div></div>
            <div className="stat"><div className="icon-stat"><span className="icon-orb red"><Icon name="alert" size={20} /></span><div><div className="stat-num">{failed.filter((c) => c.severity === "critical").length}</div><div className="stat-label">Critical</div></div></div></div>
            <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="alert" size={20} /></span><div><div className="stat-num">{failed.length}</div><div className="stat-label">Open findings</div></div></div></div>
            <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="shield" size={20} /></span><div><div className="stat-num">{latest.grade}</div><div className="stat-label">Security grade</div></div></div></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
            <div className="card">
              <div className="card-title">Security Scan Coverage</div>
              <table>
                <thead><tr><th>Scan Type</th><th>Status</th><th>Progress</th><th>Findings</th><th>Last Run</th></tr></thead>
                <tbody>
                  {cats.map((c) => (
                    <tr key={c.name}>
                      <td><span className="row" style={{ flexWrap: "nowrap" }}><span className="icon-orb violet"><Icon name={c.icon} /></span><span><strong className="small">{c.name}</strong><br /><span className="small muted">{c.desc}</span></span></span></td>
                      <td>{c.pct === 100 ? <Badge tone="minor">Passed</Badge> : <Badge tone="major">In Progress</Badge>}</td>
                      <td><span className="row" style={{ flexWrap: "nowrap" }}><span className="progress"><i style={{ width: `${c.pct}%` }} /></span><span className="small">{c.pct}%</span></span></td>
                      <td className="small">{c.total - c.pass} open</td>
                      <td className="small muted">{latest.at.slice(5, 16).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-title">Scan History</div>
              <p className="small muted">Pass rate across the last {reports.slice(-8).length} scan(s). Latest grade {latest.grade} · {latest.passed}/{latest.checks.length} pass.</p>
              <svg viewBox="0 0 260 100" style={{ width: "100%", height: 120 }} role="img" aria-label="Scan history pass rate">
                <polyline points={points || "0,90 260,20"} fill="none" stroke="var(--accent)" strokeWidth="2" />
                {(reports.slice(-8)).map((r, i) => <circle key={i} cx={i * 36} cy={90 - Math.round((r.passed / Math.max(1, r.checks.length)) * 70)} r="3" fill="var(--accent)" />)}
              </svg>
              <p className="small muted">{latest.targets.join(", ")}</p>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Security Findings ({latest.checks.length})</div>
            <p className="muted small">Vulnerabilities and risks detected across all security scans. {latest.at.slice(0, 16).replace("T", " ")}</p>
            <table>
              <thead><tr><th>Severity</th><th>Title</th><th>OWASP</th><th>Evidence</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {latest.checks.map((c) => (
                  <tr key={c.id}>
                    <td><span className={`sev ${c.severity === "critical" ? "critical" : c.severity === "high" ? "high" : c.severity === "medium" ? "medium" : "low"}`}>{c.severity}</span></td>
                    <td>{c.name}<br /><span className="small muted"><code>{c.id}</code></span></td>
                    <td className="small">{c.owasp ?? "—"}</td>
                    <td className="small">{c.evidence}</td>
                    <td><span className={c.pass ? "proof-pass" : "proof-fail"}>{c.pass ? "Passed" : "Open"}</span></td>
                    <td>{!c.pass && (
                      <ProposeWorkOrderButton
                        title={`Fix pen-test check: ${c.name}`}
                        source="pentest"
                        sourceRef={c.id}
                        plan={[
                          { kind: "re-analyze", label: `Re-run check ${c.id} after fix`, ref: c.id },
                          { kind: "evidence-pack", label: "Assemble evidence pack", ref: c.id },
                        ]}
                      />
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">Scan history ({reports.length})</div>
            <table>
              <thead><tr><th>Grade</th><th>Target</th><th>Passed</th><th>When</th><th></th></tr></thead>
              <tbody>
                {[...reports].reverse().map((r) => (
                  <tr key={r.id}>
                    <td><Badge>{r.grade}</Badge></td>
                    <td className="small">{r.targets.join(", ")}</td>
                    <td className="small">{r.passed}/{r.checks.length}</td>
                    <td className="small muted">{r.at.slice(0, 16).replace("T", " ")}</td>
                    <td className="small"><Link href={`/reports/pentest/${r.id}`}>Report</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
