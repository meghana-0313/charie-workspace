import Link from "next/link";
import { listWorkOrders } from "@/lib/guardian";
import { SuiteNav } from "@/components/suite-nav";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  const orders = await listWorkOrders();
  const open = orders.filter((o) => !["done", "failed", "rolledback"].includes(o.status));
  return (
    <>
      <p><Link href="/guardian">← Guardian</Link></p>
      <SuiteNav current="/guardian/work" />
      <div className="panel">
        <h2>Work Orders ({orders.length})</h2>
        <p className="muted small">
          Approved units of autonomous remediation. Propose one from an incident, a signal cluster,
          or a pen-test check; approve it; Night Shift executes overnight and reports proofs.
        </p>
        {orders.length === 0 ? (
          <p className="muted">None yet. Open an incident and press Propose work order.</p>
        ) : (
          <table>
            <thead><tr><th>Title</th><th>Source</th><th>Status</th><th>Risk</th><th>Updated</th></tr></thead>
            <tbody>
              {[...orders].reverse().map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/guardian/work/${o.id}`}>{o.title}</Link></td>
                  <td className="small muted">{o.source} {o.sourceRef}</td>
                  <td><span className="pill">{o.status}</span></td>
                  <td><span className="pill">{o.risk}</span></td>
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
