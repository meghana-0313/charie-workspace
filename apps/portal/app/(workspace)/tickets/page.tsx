import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { NewInvestigationButton } from "@/components/modal";
import { readFindings } from "@/lib/engine";
import type { FindingView } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: newParam } = await searchParams;
  const myUid = scopeUid(await identity());
  const tickets = await store.listTickets(myUid);
  const defaultTarget = (await store.getSetting("defaultTargetUrl").catch(() => null)) ?? "";
  const open = tickets.filter((t) => t.status !== "closed" && t.status !== "verified").length;
  const verified = tickets.filter((t) => t.status === "verified").length;
  const active = tickets.filter((t) => ["investigating", "fixing", "verifying"].includes(t.status)).length;
  const isOnCall = (t: (typeof tickets)[number]) => (t.sourceRepo ?? "").startsWith("meet:");
  const onCall = tickets.filter(isOnCall);
  const engineering = tickets.filter((t) => !isOnCall(t));
  // On-call tickets arrive pre-digested from a live call: summary in the
  // body, and the investigation has usually already run - surface its top
  // finding, root cause, and proposed fix right here, with the approval
  // state, so nobody has to open five pages to decide.
  const onCallViews = await Promise.all(onCall.map(async (t) => {
    const room = t.roomId ? await store.getRoom(t.roomId) : null;
    let finding: FindingView | null = null;
    let runId: string | null = null;
    if (room) {
      for (const rid of room.runIds) {
        const fs = await readFindings(rid).catch(() => null);
        if (fs && fs.length > 0) { finding = fs[0]; runId = rid; break; }
      }
    }
    const approvals = room ? await store.listApprovals(room.id) : [];
    const approved = Boolean(finding && approvals.some((a) => a.findingIds.includes(finding!.id))) || t.status === "verified" || t.status === "closed";
    return { t, finding, runId, approved };
  }));
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/tickets", "Tickets and fixes"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="ticket" size={19} /></span> Tickets and fixes</>}
        sub="On-call tickets from live calls arrive pre-digested - summary, findings, root cause, proposed fix - waiting for your approval. Engineering tickets below carry the full investigation, findings, and verified fix."
        actions={<NewInvestigationButton defaultTarget={defaultTarget} autoOpen={newParam === "1"} />}
      />
      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="ticket" size={20} /></span><div><div className="stat-num">{open}</div><div className="stat-label">Open tickets</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="search" size={20} /></span><div><div className="stat-num">{active}</div><div className="stat-label">Under investigation</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{verified}</div><div className="stat-label">Verified fixes</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="layers" size={20} /></span><div><div className="stat-num">{tickets.length}</div><div className="stat-label">Total tickets</div></div></div></div>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-title">On-call tickets ({onCallViews.length}) <Badge>From Meet calls</Badge></div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Tickets Charie filed from live calls, already digested: call summary, findings, root cause, and a proposed fix.
          Nothing changes code until you approve it on the ticket.
        </p>
        {onCallViews.length === 0 ? (
          <p className="muted small">No on-call tickets yet. Approve an investigation during a Meet call and the ticket lands here, ready to review.</p>
        ) : onCallViews.map(({ t, finding, runId, approved }) => (
          <div key={t.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}>
            <p style={{ margin: "0 0 8px" }}>
              <Link href={`/tickets/${t.id}`}><strong>{t.subject}</strong></Link>{" "}
              <Badge tone={t.status}>{t.status}</Badge> <Badge>live call</Badge>
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              <div>
                <strong className="small">Call summary</strong>
                <p className="small muted" style={{ margin: "4px 0 0", lineHeight: 1.55 }}>{t.body.slice(0, 420)}{t.body.length > 420 ? "..." : ""}</p>
              </div>
              <div>
                <strong className="small">Findings</strong>
                {finding ? (
                  <p className="small" style={{ margin: "4px 0 0", lineHeight: 1.55 }}>{finding.title} <Badge tone={finding.severity}>{finding.severity}</Badge><br /><span className="muted">Root cause: {finding.suspectedCause}</span></p>
                ) : (
                  <p className="small muted" style={{ margin: "4px 0 0" }}>Investigation has not produced findings yet - they land here when the run finishes.</p>
                )}
              </div>
              <div>
                <strong className="small">Proposed fix</strong>
                {finding ? (
                  <p className="small" style={{ margin: "4px 0 0", lineHeight: 1.55 }}>{finding.suggestedFix}</p>
                ) : (
                  <p className="small muted" style={{ margin: "4px 0 0" }}>Arrives with the findings.</p>
                )}
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              {approved
                ? <Badge tone="done">Fix approved - ready for the coding agent</Badge>
                : finding
                  ? <Badge tone="major">Waiting for your approval</Badge>
                  : <Badge>Waiting for findings</Badge>}
              <Link className="btn secondary sm" href={`/tickets/${t.id}`}>{approved ? "Open ticket" : "Review and approve"}</Link>
              {runId && <Link className="small" href={`/reports/agent-run/${runId}`}>Investigation report</Link>}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="card">
          <div className="card-title">Engineering tickets ({engineering.length})</div>
          {engineering.length === 0 ? (
            <EmptyState title="No engineering tickets yet" body="Use New investigation above. Example: Checkout button does nothing." />
          ) : (
            <table>
              <thead><tr><th>Ticket</th><th>Goal</th><th>Status</th><th>Opened</th><th></th></tr></thead>
              <tbody>
                {engineering.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/tickets/${t.id}`}><strong className="small">{t.subject}</strong></Link>
                      <br /><span className="small muted"><code>{t.id}</code>{t.sourceRepo ? ` · ${t.sourceRepo}` : ""}</span>
                    </td>
                    <td className="small muted">{t.goal}</td>
                    <td><Badge tone={t.status}>{t.status}</Badge></td>
                    <td className="small muted">{t.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td><Link href={`/tickets/${t.id}`} aria-label={`Open ${t.subject}`}><Icon name="arrow" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
