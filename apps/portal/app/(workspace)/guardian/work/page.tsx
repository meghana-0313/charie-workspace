import Link from "next/link";
import { listWorkOrders } from "@/lib/guardian";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  const orders = await listWorkOrders();
  const open = orders.filter((o) => !["done", "failed", "rolledback"].includes(o.status));
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/work", "Fix tasks"]]}
        title={`Fix tasks (${orders.length})`}
        sub="Ordered remediation work with proofs. Propose one from a threat, a signal cluster, or a pen-test check; approve it; night shift executes overnight and reports proofs."
      />
      <div className="card">
        {orders.length === 0 ? (
          <EmptyState title="No work orders" body="Open an incident and press Propose work order." />
        ) : (
          <table>
            <thead><tr><th>Title</th><th>Source</th><th>Status</th><th>Risk</th><th>Updated</th></tr></thead>
            <tbody>
              {[...orders].reverse().map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/guardian/work/${o.id}`}>{o.title}</Link></td>
                  <td className="small muted">{o.source} {o.sourceRef}</td>
                  <td><Badge tone={o.status}>{o.status}</Badge></td>
                  <td><Badge tone={o.risk}>{o.risk}</Badge></td>
                  <td className="small muted">{o.updatedAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {open.length > 0 && (
          <p className="small" style={{ marginTop: 8 }}>
            <Link href="/guardian/night">{open.length} open order(s) waiting for the next shift →</Link>
          </p>
        )}
      </div>
    </>
  );
}
