import Link from "next/link";
import { listDigests, listWorkOrders } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";
import { NightShiftButton } from "@/components/suite";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

type DigestRow = { kind: "lead" | "order" | "security" | "logs" | "next" | "line"; text: string; status?: string };

/** The engine digest is plain text lines; render them as a readable
 *  visual report (status chips, sections, links), never a raw pre dump. */
function digestRows(digest: string): DigestRow[] {
  return digest.split("\n").map((raw) => raw.trim()).filter(Boolean).map((line, i) => {
    if (i === 0) return { kind: "lead", text: line };
    const numbered = line.match(/^\d+[.)]\s*(.*)$/);
    if (numbered) {
      const text = numbered[1];
      const status = /passed/i.test(text) ? "PASSED" : /scheduled/i.test(text) ? "SCHEDULED" : /failed/i.test(text) ? "FAILED" : /done|completed/i.test(text) ? "DONE" : undefined;
      return { kind: "order", text, status };
    }
    if (/security re-scan|pentest/i.test(line)) return { kind: "security", text: line };
    if (/log watch|errors? (were )?grouped|signatures/i.test(line)) return { kind: "logs", text: line };
    if (/nothing is waiting|next sweep|waiting on approval/i.test(line)) return { kind: "next", text: line };
    return { kind: "line", text: line };
  });
}

const ROW_ICON: Record<DigestRow["kind"], string> = { lead: "moon", order: "order", security: "shield", logs: "signal", next: "check", line: "layers" };

export default async function NightPage() {
  const digests = await listDigests(scopeUid(await identity()));
  const orders = await listWorkOrders(scopeUid(await identity()));
  const eligible = orders.filter((o) => o.status === "approved" || o.status === "scheduled");
  const latest = digests.at(-1);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/night", "Night shift"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="moon" size={19} /></span> Night shift</>}
        sub="Approved work orders execute overnight: autonomous re-verifications, security re-scans, evidence packs, and remediation notes. The morning digest lands here and pushes to your phone."
        actions={<><Link className="btn secondary" href="/reports">All reports</Link><NightShiftButton /></>}
      />
      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="order" size={20} /></span><div><div className="stat-num">{eligible.length}</div><div className="stat-label">Orders eligible now</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{latest ? latest.orders.filter((o) => o.status === "done").length : 0}</div><div className="stat-label">Done last shift</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="shield" size={20} /></span><div><div className="stat-num">{latest?.pentest?.grade ?? "n/a"}</div><div className="stat-label">Last re-scan grade</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="layers" size={20} /></span><div><div className="stat-num">{digests.length}</div><div className="stat-label">Shifts completed</div></div></div></div>
      </div>
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
            <div className="card-title">Latest digest <Badge>{latest.at.slice(0, 16).replace("T", " ")}</Badge>{latest.pentest && <> <Link className="small" href={`/reports/pentest/${latest.pentest.id}`}>Re-scan report</Link></>}</div>
            {digestRows(latest.digest).map((row, i) => row.kind === "lead" ? (
              <p key={i} style={{ fontSize: 17, lineHeight: 1.5, margin: "4px 0 14px" }}><strong>{row.text}</strong></p>
            ) : (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", borderTop: "1px solid var(--line)", padding: "12px 0" }}>
                <span className="icon-orb violet" style={{ flex: "none" }}><Icon name={ROW_ICON[row.kind]} size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
                    {row.status && <Badge tone={row.status === "PASSED" || row.status === "DONE" ? "done" : row.status === "FAILED" ? "major" : "minor"}>{row.status}</Badge>}{row.status ? " " : ""}{row.text}
                  </p>
                  {row.kind === "security" && latest.pentest && <p style={{ margin: "6px 0 0" }}><Link href={`/reports/pentest/${latest.pentest.id}`}>Open the full security re-scan report</Link> <span className="muted small">- grade {latest.pentest.grade}, {latest.pentest.passed} of {latest.pentest.passed + latest.pentest.failed} checks passed</span></p>}
                  {row.kind === "logs" && <p style={{ margin: "6px 0 0" }}><Link href="/guardian/signals">See the grouped errors in Live Signals</Link></p>}
                  {row.kind === "next" && <p style={{ margin: "6px 0 0" }}><Link href="/autopilot">Check the next sweep schedule</Link></p>}
                </div>
              </div>
            ))}
          </div>
          {latest.orders.length > 0 && (
            <div className="card">
              <div className="card-title">Work done on this shift</div>
              {latest.orders.map((o) => (
                <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", borderTop: "1px solid var(--line)", padding: "10px 0", flexWrap: "wrap" }}>
                  <Badge tone={o.status === "done" ? "done" : o.status === "failed" ? "major" : "minor"}>{o.status}</Badge>
                  <span style={{ flex: 1, minWidth: 220, fontSize: 15 }}>{o.title}</span>
                  <span className="small muted">{o.proofs.length} proof{o.proofs.length === 1 ? "" : "s"} attached</span>
                  <Link className="small" href={`/guardian/work/${o.id}`}>Open work order</Link>
                </div>
              ))}
            </div>
          )}
          {digests.length > 1 && (
            <div className="card">
              <div className="card-title">Shift history</div>
              <table>
                <thead><tr><th>Shift</th><th>Orders</th><th>Done</th><th>Re-scan grade</th><th>Duration</th><th></th></tr></thead>
                <tbody>
                  {[...digests].reverse().map((d) => (
                    <tr key={d.id}>
                      <td className="small"><code>{d.id}</code></td>
                      <td>{d.orders.length}</td>
                      <td>{d.orders.filter((o) => o.status === "done").length}</td>
                      <td><Badge>{d.pentest?.grade ?? "n/a"}</Badge></td>
                      <td className="small muted">{Math.round(d.durationMs / 1000)}s</td>
                      <td className="small">{d.pentest ? <Link href={`/reports/pentest/${d.pentest.id}`}>Report</Link> : <span className="muted">-</span>}</td>
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
