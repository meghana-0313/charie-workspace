import Link from "next/link";
import { listClusters } from "@/lib/guardian";
import { SuiteNav } from "@/components/suite-nav";
import { ProposeWorkOrderButton, SeedSignalsButton, SignalsIngestForm } from "@/components/suite";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const { total, clusters } = await listClusters();
  return (
    <>
      <p><Link href="/guardian">← Guardian</Link></p>
      <SuiteNav current="/guardian/signals" />
      <div className="grid2">
        <div className="panel">
          <h2>Customer signals ({total} messages)</h2>
          <p className="muted small">
            Support, chat, call transcripts, and reviews. Spark grades sentiment and theme per
            message; the engine clusters them into themes. Hot clusters become work orders.
          </p>
          <SignalsIngestForm />
          <div style={{ marginTop: 10 }}><SeedSignalsButton /></div>
        </div>
        <div className="panel">
          <h2>Theme clusters ({clusters.length})</h2>
          {clusters.length === 0 ? (
            <p className="muted small">Nothing clustered yet. Load the demo inbox to see it work.</p>
          ) : (
            clusters.map((c) => (
              <div key={c.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                <p>
                  <strong>{c.theme}</strong> <span className="pill">{c.size} msgs</span>{" "}
                  <span className="pill">{Math.round(c.angryShare * 100)}% hot</span>
                </p>
                <ul className="small muted">
                  {c.samples.map((s, i) => <li key={i}>“{s}”</li>)}
                </ul>
                <ProposeWorkOrderButton
                  title={`Address customer theme: ${c.theme}`}
                  source="signals"
                  sourceRef={c.id}
                  plan={[
                    { kind: "re-analyze", label: `Re-scan services behind theme ${c.theme}`, ref: c.id },
                    { kind: "docs-note", label: "Draft remediation note from proofs", ref: c.id },
                    { kind: "evidence-pack", label: "Assemble evidence pack", ref: c.id },
                  ]}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
