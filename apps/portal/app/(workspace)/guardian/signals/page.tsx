import { listClusters } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";
import { ClusterTicketButton, LiveMonitorPanel, ProposeWorkOrderButton, SeedSignalsButton, SignalsIngestForm } from "@/components/suite";
import { Icon } from "@/components/icons";
import { Badge, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const { total, clusters } = await listClusters(scopeUid(await identity()));
  const hottest = clusters.reduce((m, c) => Math.max(m, c.angryShare), 0);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/signals", "Live Signals"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="signal" size={19} /></span> Live Signals</>}
        sub="Two live feeds: the site monitor probes your product every 3 seconds and plots what it really measures, and message signals from support, chat, calls, and reviews - Spark grades sentiment per message, the engine clusters themes, hot clusters become work orders."
      />
      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="chat" size={20} /></span><div><div className="stat-num">{total}</div><div className="stat-label">Messages ingested</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="layers" size={20} /></span><div><div className="stat-num">{clusters.length}</div><div className="stat-label">Theme clusters</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb red"><Icon name="alert" size={20} /></span><div><div className="stat-num">{Math.round(hottest * 100)}%</div><div className="stat-label">Hottest cluster heat</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="ticket" size={20} /></span><div><div className="stat-num">{clusters.filter((c) => c.angryShare >= 0.5).length}</div><div className="stat-label">Hot clusters</div></div></div></div>
      </div>
      <LiveMonitorPanel />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
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
                <div className="progress" style={{ maxWidth: 320, marginBottom: 8 }}><i style={{ width: `${Math.round(c.angryShare * 100)}%` }} /></div>
                <ul className="small muted">
                  {c.samples.map((s, i) => <li key={i}>“{s}”</li>)}
                </ul>
                <ClusterTicketButton theme={c.theme} samples={c.samples} size={c.size} angryShare={c.angryShare} />
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
        <div className="card">
          <div className="card-title"><span className="icon-orb violet"><Icon name="send" /></span> Ingest</div>
          <SignalsIngestForm />
          <div style={{ marginTop: 10 }}><SeedSignalsButton /></div>
        </div>
      </div>
    </>
  );
}
