import Link from "next/link";
import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { readFindings, readReportMd, readVerification, runStatus } from "@/lib/engine";
import { readBriefs } from "@/lib/guardian";
import { boxesFor, GroundedShot, RedesignBriefs } from "@/components/evidence";
import { ApproveButton, MessageForm, RunButtons } from "@/components/forms";
import { DispatchButton } from "@/components/suite";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoomView ticketId={id} />;
}

async function RoomView({ ticketId }: { ticketId: string }) {
  const ticket = await store.getTicket(ticketId);
  if (!ticket) notFound();
  const myUid = scopeUid(await identity());
  if (myUid && ticket.uid && ticket.uid !== myUid) notFound();
  const room = ticket.roomId ? await store.getRoom(ticket.roomId) : null;
  if (!room) notFound();

  // Refresh run statuses from the engine service.
  for (const runId of room.runIds) {
    const st = await runStatus(runId);
    const rec = await store.getRun(runId);
    if (rec && rec.status === "running" && st !== "running") await store.setRunStatus(runId, st);
  }
  const runViews = await Promise.all(room.runIds.map(async (runId) => {
    const rec = await store.getRun(runId);
    return { runId, rec, status: await runStatus(runId), findings: (await readFindings(runId)) ?? [], verification: await readVerification(runId), report: await readReportMd(runId), briefs: await readBriefs(runId) };
  }));
  const baseline = runViews.find((r) => r.rec?.kind === "investigate" && r.status === "done");
  const messages = await store.listMessages(room.id);
  const approvals = await store.listApprovals(room.id);
  const approvedIds = new Set(approvals.flatMap((a) => a.findingIds));
  const findingCount = runViews.reduce((n, r) => n + r.findings.length, 0);

  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], [`/tickets/${ticket.id}`, ticket.subject.slice(0, 40)]]}
        title={<>{ticket.subject} <Badge tone={ticket.status}>{ticket.status}</Badge></>}
        sub={ticket.body}
        actions={<RunButtons ticketId={ticket.id} roomId={room.id} targetUrl={ticket.targetUrl} goal={ticket.goal} baselineRunId={baseline?.runId} />}
      />

      <div className="card">
        <div className="small muted">Goal: {ticket.goal}</div>
        <div className="small muted">Target: <code>{ticket.targetUrl}</code>
          {ticket.voiceNotePath && <> · Voice note <code>{ticket.voiceNotePath}</code><br /><audio controls src={`/api/${ticket.voiceNotePath}`} style={{ marginTop: 6, maxWidth: "100%" }} /></>}
        </div>
        <div className="small muted">{findingCount} finding(s) across {runViews.length} run(s)</div>
      </div>

      {runViews.length === 0 && (
        <div className="card">
          <EmptyState title="No runs yet" body="Press Run investigation above, then refresh in about a minute." />
        </div>
      )}

      {runViews.map(({ runId, rec, status, findings, verification, report, briefs }) => (
        <div className="card" key={runId}>
          <div className="card-title">{rec?.kind === "verify" ? "Verification" : "Investigation"} <Badge tone={status}>{status}</Badge></div>
          <p className="small muted"><code>{runId}</code>{rec?.baselineRunId && <> · baseline <code>{rec.baselineRunId}</code></>}</p>
          {status === "running" && <p className="muted">Engine is driving the app… <a href="">refresh</a></p>}
          {verification != null && (
            <>
              <h3>Result</h3>
              <pre className="report">{JSON.stringify(verification, null, 2)}</pre>
            </>
          )}
          {findings.map((f) => (
            <div key={f.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
              <p><strong>{f.title}</strong> <Badge tone={f.severity}>{f.severity}</Badge> <Badge>{f.category}</Badge> <Badge>{f.analysisSource}</Badge></p>
              <p className="small"><code>{f.id}</code> · suspected cause: {f.suspectedCause} (confidence: {f.confidence})</p>
              <p className="small">Suggested fix: {f.suggestedFix}</p>
              <ol className="repro">{f.reproSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              {f.evidence.screenshots.map((s) => {
                const boxes = boxesFor(f, s);
                return boxes.length > 0 ? (
                  <GroundedShot key={s} src={`/api/artifacts/${runId}/${s}`} alt={`${f.id} evidence ${s}`} boxes={boxes} />
                ) : (
                  <img key={s} className="shot" src={`/api/artifacts/${runId}/${s}`} alt={`${f.id} evidence ${s}`} />
                );
              })}
              <div className="row" style={{ marginTop: 6 }}>
                {approvedIds.has(f.id)
                  ? <Badge tone="approved">fix instruction approved</Badge>
                  : <ApproveButton roomId={room.id} findingId={f.id} instruction={f.suggestedFix} />}
                <Link className="small" href={`/api/artifacts/${runId}/mcp-packets/${f.id}.md`}>fix packet</Link>
              </div>
            </div>
          ))}
          <RedesignBriefs briefs={briefs} runId={runId} />
          {report && (
            <details style={{ marginTop: 10 }}>
              <summary className="small">Full report.md</summary>
              <pre className="report">{report}</pre>
            </details>
          )}
        </div>
      ))}

      <div className="grid2">
        <div className="card">
          <div className="card-title">Room discussion ({messages.length})</div>
          {messages.length === 0 && <p className="muted small">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.authorType}`}>
              <div className="who">{m.authorName} · {m.createdAt.slice(0, 16).replace("T", " ")}</div>
              <div>{m.body}</div>
            </div>
          ))}
          <MessageForm roomId={room.id} />
        </div>
        <div className="card">
          <div className="card-title">Approved instructions ({approvals.length})</div>
          {approvals.length === 0 && <p className="muted small">Approve a finding’s fix above to queue it for the coding agent.</p>}
          {approvals.map((a) => (
            <div key={a.id} className="msg">
              <div className="who">{a.approvedBy} · {a.createdAt.slice(0, 16).replace("T", " ")} · <Badge tone={a.status}>{a.status}</Badge></div>
              <div className="small"><code>{a.findingIds.join(", ")}</code></div>
              <div>{a.instruction}</div>
              {a.status === "approved" && (
                <div style={{ marginTop: 6 }}><DispatchButton approvalId={a.id} roomId={room.id} /></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
