import Link from "next/link";
import { identity, scopeUid } from "@/lib/who";
import { listWorkOrders } from "@/lib/guardian";
import { WorkOrderButtons } from "@/components/suite";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return iso.slice(5, 16).replace("T", " ");
}

export default async function WorkOrdersPage() {
  const orders = await listWorkOrders(scopeUid(await identity()));
  const list = [...orders].reverse();
  const sel = list[0];
  const counts = {
    open: list.filter((o) => o.status === "proposed").length,
    review: list.filter((o) => o.status === "approved").length,
    running: list.filter((o) => o.status === "scheduled").length,
    closed: list.filter((o) => ["done", "failed", "rolledback"].includes(o.status)).length,
  };
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/work", "Fix Tasks"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="code" size={19} /></span> Fix Tasks / Work Orders</>}
        sub="AI-generated fixes for incidents, bugs, and operational issues. Review, approve and run safely in your environment."
        actions={<Link href="/tickets#new" className="btn">+ New Work Order</Link>}
      />
      <div className="tabs">
        <span className="tab on" style={{ padding: "7px 14px" }}>All Work Orders ({list.length})</span>
        <span className="small muted" style={{ alignSelf: "center" }}>Open ({counts.open}) · In Review ({counts.review}) · Approved ({counts.running}) · Closed ({counts.closed})</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div className="card">
          {list.length === 0 ? (
            <EmptyState title="No work orders" body="Open an incident and press Propose work order." />
          ) : (
            <table>
              <thead><tr><th>ID</th><th>Linked</th><th>Proposed Fix (Summary)</th><th>Risk</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {list.map((o, i) => (
                  <tr key={o.id} style={i === 0 ? { background: "var(--accent-dim)" } : undefined}>
                    <td className="small"><code>{o.id.slice(0, 12)}</code></td>
                    <td className="small">{o.source} · {String(o.sourceRef).slice(0, 14)}</td>
                    <td><Link href={`/guardian/work/${o.id}`}><strong>{o.title}</strong></Link><br /><span className="small muted">{o.plan.length} step(s) · {o.proofs.length} proof(s)</span></td>
                    <td><span className={`sev ${o.risk === "high" ? "critical" : o.risk === "medium" ? "medium" : "low"}`}>{o.risk}</span></td>
                    <td><Badge tone={o.status}>{o.status}</Badge></td>
                    <td className="small muted">{when(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="small muted">Showing 1–{list.length} of {list.length} work orders</p>
        </div>

        <div className="card">
          {sel ? (
            <>
              <div className="row"><span className="icon-orb violet"><Icon name="code" /></span><div><strong>{sel.id.slice(0, 12)}</strong><br /><span className="small muted">{sel.source} · Created {when(sel.createdAt)}</span></div><span className="spacer" /><Badge tone={sel.status}>{sel.status}</Badge></div>
              <h3 style={{ margin: "12px 0 4px", fontSize: "var(--text-lg)" }}>{sel.title}</h3>
              <div className="tabs" style={{ marginTop: 10 }}><span className="tab on" style={{ padding: "6px 12px" }}>Details</span><span className="small muted" style={{ alignSelf: "center" }}>Plan · Proofs · Activity</span></div>
              <div className="section-label">Proposed Change (Summary)</div>
              <p className="small muted">Ordered remediation with human approval before execution. Night shift executes approved orders and reports proofs.</p>
              <div className="section-label">Plan ({sel.plan.length})</div>
              <ul className="small" style={{ marginTop: 0 }}>
                {sel.plan.map((s, i) => <li key={i}>✓ {s.label} <span className="muted">({s.kind})</span></li>)}
              </ul>
              <div className="section-label">Risk Assessment</div>
              <p className="small"><span className={`sev ${sel.risk === "high" ? "critical" : sel.risk === "medium" ? "medium" : "low"}`}>{sel.risk}</span> <span className="muted">· {sel.approvals.length} approval(s) · {sel.proofs.length} proof(s) attached</span></p>
              <div className="section-label">Approval</div>
              <p className="small muted" style={{ background: "var(--accent-dim)", borderRadius: "var(--radius-md)", padding: 10 }}>Approval required to run this fix in Production.</p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <Link href={`/guardian/work/${sel.id}`} className="btn secondary sm">Review diff</Link>
                <WorkOrderButtons id={sel.id} status={sel.status} />
              </div>
            </>
          ) : (
            <EmptyState title="Nothing selected" body="Work orders you propose appear here with their approval rail." />
          )}
        </div>
      </div>
    </>
  );
}
