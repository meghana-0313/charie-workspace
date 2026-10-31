import { listDigests, listWorkOrders } from "@/lib/guardian";
import { NightShiftButton } from "@/components/suite";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NightPage() {
  const digests = await listDigests();
  const orders = await listWorkOrders();
  const eligible = orders.filter((o) => o.status === "approved" || o.status === "scheduled");
  const latest = digests.at(-1);
  return (
    <>
      <PageHead
        crumbs={[["/", "Overview"], ["/guardian/night", "Night Shift"]]}
        title="Night Shift"
        sub="Approved work orders execute overnight: autonomous re-verifications, security re-scans, evidence packs, and remediation notes. The morning digest lands here and pushes to your phone."
        actions={<NightShiftButton />}
      />
      <div className="card">
        <div className="card-title">Shift control</div>
        <p className="small muted">
          {eligible.length} order(s) eligible right now. Browser re-verifications claim the same
          single-run lock as portal runs, so the shift never fights a human-driven run.
        </p>
      </div>
      {!latest ? (
        <div className="card">
          <EmptyState title="No shifts yet" body="Approve a work order, then run the shift to see the digest." />
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-title">Latest digest <Badge>{latest.at.slice(0, 16).replace("T", " ")}</Badge></div>
            <pre className="report">{latest.digest}</pre>
          </div>
          {digests.length > 1 && (
            <div className="card">
              <div className="card-title">Shift history</div>
              <table>
                <thead><tr><th>Shift</th><th>Orders</th><th>Done</th><th>Re-scan grade</th><th>Duration</th></tr></thead>
                <tbody>
                  {[...digests].reverse().map((d) => (
                    <tr key={d.id}>
                      <td className="small"><code>{d.id}</code></td>
                      <td>{d.orders.length}</td>
                      <td>{d.orders.filter((o) => o.status === "done").length}</td>
                      <td><Badge>{d.pentest?.grade ?? "n/a"}</Badge></td>
                      <td className="small muted">{Math.round(d.durationMs / 1000)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
