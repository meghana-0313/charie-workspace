import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { ConnectForm, GithubConnect } from "@/components/repo-forms";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

const SUITES = [
  ["flask", "Unit tests", "Validate individual components and functions.", "~ 3 min", true],
  ["layers", "Integration tests", "Test interactions between modules and services.", "~ 6 min", true],
  ["play", "End-to-end (E2E) tests", "Validate core user flows in a real environment.", "~ 12 min", true],
  ["access", "Accessibility tests", "Check for accessibility issues (WCAG 2.1 AA).", "~ 4 min", false],
  ["shield", "Security tests", "Scan for common vulnerabilities and misconfigurations.", "~ 7 min", true],
] as const;

export default async function ReposPage() {
  const myUid = scopeUid(await identity());
  const repos = await store.listRepos(myUid);
  const buildsReady = Boolean(process.env.GCP_PROJECT_ID && process.env.GCS_BUCKET);
  const primary = repos[0];
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/repos", "Repositories"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="repo" size={19} /></span> Repositories — Connect & Test</>}
        sub="Link a repository, configure the test run, and validate your code with Charie."
      />
      <div className="card" style={{ padding: "var(--space-4) var(--space-5)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr", gap: 10, alignItems: "center" }} className="steps-row">
          {[["1", "Connect repository", "Link your codebase", true], ["2", "Configure", "Set branch and stack", false], ["3", "Select tests", "Choose test suites", false], ["4", "Review", "Confirm and run", false]].map(([n, t, s, on]) => (
            <div key={String(n)} style={{ display: "contents" }}>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <span className="initials" style={{ width: 34, height: 34, background: on ? "var(--accent)" : "var(--surface-overlay)", color: on ? "#fff" : "var(--ink-muted)" }}>{n}</span>
                <span><strong className="small">{t}</strong><br /><span className="small muted">{s}</span></span>
              </div>
              {n !== "4" && <span style={{ height: 1, background: "var(--line-strong)", minWidth: 24 }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div>
          <div className="card">
            <div className="card-title">1. Choose a Git provider</div>
            {!buildsReady && <p className="small" style={{ color: "var(--warn)" }}>Builds need GCP_PROJECT_ID + GCS_BUCKET on the portal. Connecting works anywhere; building runs in prod (or ADC locally).</p>}
            <div className="grid2">
              <div style={{ border: "1px solid var(--accent)", background: "var(--accent-dim)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
                <div className="row"><span className="icon-orb" style={{ background: "#fff", color: "#111" }}><Icon name="repo" /></span><div><strong>GitHub</strong><br /><span className="small muted">Connect a GitHub repository</span></div><span className="spacer" /><Badge tone="minor">Selected</Badge></div>
                <div style={{ marginTop: 12 }}><GithubConnect /></div>
              </div>
              <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", opacity: 0.75 }}>
                <div className="row"><span className="icon-orb" style={{ background: "#fc6d26", color: "#fff" }}><Icon name="layers" /></span><div><strong>GitLab</strong><br /><span className="small muted">Connect a GitLab repository</span></div><span className="spacer" /><Badge>Soon</Badge></div>
                <p className="small muted" style={{ marginTop: 12 }}>GitLab lands next. Paste any public repo URL below today.</p>
              </div>
            </div>
            <div className="section-label">Or paste a URL</div>
            <ConnectForm />
          </div>

          <div className="card">
            <div className="card-title">2. Repository & configuration</div>
            {repos.length === 0 ? <EmptyState title="None yet" body="Connect your first repo above to build and test it here." /> : (
              <table>
                <thead><tr><th>Repository</th><th>Branch</th><th>Status</th><th>App</th><th></th></tr></thead>
                <tbody>
                  {repos.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/repos/${r.id}`}><strong>{r.owner}/{r.repo}</strong></Link></td>
                      <td className="small">{r.branch}{r.subdir ? ` · ${r.subdir}` : ""}</td>
                      <td><Badge tone={r.status === "live" ? "minor" : r.status === "failed" ? "failed" : undefined}>{r.status}</Badge></td>
                      <td className="small">{r.appUrl ? <a href={r.appUrl} target="_blank" rel="noreferrer">open</a> : <span className="muted">-</span>}</td>
                      <td><Link href={`/repos/${r.id}`} className="btn secondary sm">Configure & build</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-title">3. Select test suites</div>
            <p className="muted small">Choose which tests Charie should run on this repository. Suites map to the investigation presets on each repo.</p>
            {SUITES.map(([icon, name, desc, eta, on]) => (
              <div key={name} className="row" style={{ borderTop: "1px solid var(--line)", padding: "10px 0", flexWrap: "nowrap" }}>
                <span className="icon-orb violet"><Icon name={icon} /></span>
                <span style={{ flex: 1 }}><strong className="small">{name}</strong>{name === "Unit tests" && <> <Badge tone="accent">Recommended</Badge></>}<br /><span className="small muted">{desc}</span></span>
                <span className={`switch${on ? " on" : ""}`} aria-hidden><i /></span>
                <span className="small muted" style={{ width: 64, textAlign: "right" }}>{eta}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title"><Icon name="layers" /> Test configuration</div>
          <p className="muted small">Review your setup before running the tests.</p>
          <table>
            <tbody>
              <tr><td className="small muted">Repository</td><td className="small"><strong>{primary ? `${primary.owner}/${primary.repo}` : "None connected"}</strong></td></tr>
              <tr><td className="small muted">Branch</td><td className="small">{primary?.branch ?? "main"}</td></tr>
              <tr><td className="small muted">Environment</td><td className="small"><span className="env-dot" style={{ display: "inline-block", marginRight: 6 }} />Production</td></tr>
              <tr><td className="small muted">Selected tests</td><td className="small">4 of 5</td></tr>
              <tr><td className="small muted">Estimated total time</td><td className="small">~ 28 min</td></tr>
            </tbody>
          </table>
          <p className="small muted" style={{ background: "var(--accent-dim)", borderRadius: "var(--radius-md)", padding: 10 }}>Charie will run the selected tests, analyze results, and create actionable findings with fixes.</p>
          {primary ? <Link href={`/repos/${primary.id}`} className="btn" style={{ width: "100%", justifyContent: "center" }}>Run tests</Link> : <Link href="#top" className="btn" style={{ width: "100%", justifyContent: "center" }}>Connect to run</Link>}
        </div>
      </div>
    </>
  );
}
