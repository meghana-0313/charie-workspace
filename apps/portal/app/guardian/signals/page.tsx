import { listClusters } from "@/lib/guardian";
import { ProposeWorkOrderButton, SeedSignalsButton, SignalsIngestForm } from "@/components/suite";
import { Badge, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const { total, clusters } = await listClusters();
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/signals", "Live signals"]]}
        title={`Live signals (${total} messages)`}
        sub="Support, chat, call transcripts, and reviews. Spark grades sentiment and theme per message; the engine clusters them into themes. Hot clusters become work orders."
      />
      <div className="grid2">
        <div className="card">
          <div className="card-title">Ingest</div>
          <SignalsIngestForm />
          <div style={{ marginTop: 10 }}><SeedSignalsButton /></div>
        </div>
        <div className="card">
          <div className="card-title">Theme clusters ({clusters.length})</div>
          {clusters.length === 0 ? (
            <p className="muted small">Nothing clustered yet. Load the demo inbox to see it work.</p>
          ) : (
            clusters.map((c) => (
              <div key={c.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                <p>
                  <strong>{c.theme}</strong> <Badge>{c.size} msgs</Badge>{" "}
                  <Badge tone={c.angryShare >= 0.5 ? "major" : "minor"}>{Math.round(c.angryShare * 100)}% hot</Badge>
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
