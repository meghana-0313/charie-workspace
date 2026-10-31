import Link from "next/link";
import { listDigests, listWorkOrders } from "@/lib/guardian";
import { SuiteNav } from "@/components/suite-nav";
import { NightShiftButton } from "@/components/suite";

export const dynamic = "force-dynamic";

export default async function NightPage() {
  const digests = await listDigests();
  const orders = await listWorkOrders();
  const eligible = orders.filter((o) => o.status === "approved" || o.status === "scheduled");
  const latest = digests.at(-1);
  return (
    <>
      <p><Link href="/guardian">← Guardian</Link></p>
      <SuiteNav current="/guardian/night" />
      <div className="panel">
        <h2>Night Shift</h2>
        <p className="muted small">
          Approved work orders execute overnight: autonomous re-verifications, security re-scans,
          evidence packs, and remediation notes. The morning digest lands here and pushes to your phone.
          Browser re-verifications claim the same single-run lock as portal runs, so the shift never
          fights a human-driven run.
        </p>
        <div className="row">
          <NightShiftButton />
          <span className="small muted">{eligible.length} order(s) eligible right now.</span>
        </div>
      </div>
      {!latest ? (
        <div className="panel">
          <p className="muted">No shifts yet. Approve a work order, then run the shift to see the digest.</p>
        </div>
      ) : (
        <>
          <div className="panel">
            <h2>Latest digest <span className="pill">{latest.at.slice(0, 16).replace("T", " ")}</span></h2>
            <pre className="report">{latest.digest}</pre>
          </div>
          {digests.length > 1 && (
            <div className="panel">
              <h2>Shift history</h2>
              <table>
                <thead><tr><th>Shift</th><th>Orders</th><th>Done</th><th>Re-scan grade</th><th>Duration</th></tr></thead>
                <tbody>
                  {[...digests].reverse().map((d) => (
                    <tr key={d.id}>
                      <td className="small"><code>{d.id}</code></td>
                      <td>{d.orders.length}</td>
                      <td>{d.orders.filter((o) => o.status === "done").length}</td>
                      <td><span className="pill">{d.pentest?.grade ?? "n/a"}</span></td>
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
