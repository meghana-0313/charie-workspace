import Link from "next/link";
import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { readFindings, readReportMd, readVerification, runStatus } from "@/lib/engine";
import { ApproveButton, MessageForm, RunButtons } from "@/components/forms";

export const dynamic = "force-dynamic";

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => <RoomView ticketId={id} />);
}

function RoomView({ ticketId }: { ticketId: string }) {
  const ticket = store.getTicket(ticketId);
  if (!ticket) notFound();
  const room = ticket.roomId ? store.getRoom(ticket.roomId) : null;
  if (!room) notFound();

  // Refresh run statuses from disk.
  for (const runId of room.runIds) {
    const st = runStatus(runId);
    const rec = store.getRun(runId);
    if (rec && rec.status === "running" && st !== "running") store.setRunStatus(runId, st);
  }
  const runViews = room.runIds.map((runId) => {
    const rec = store.getRun(runId);
    return { runId, rec, status: runStatus(runId), findings: readFindings(runId) ?? [], verification: readVerification(runId), report: readReportMd(runId) };
  });
  const baseline = runViews.find((r) => r.rec?.kind === "investigate" && r.status === "done");
  const messages = store.listMessages(room.id);
  const approvals = store.listApprovals(room.id);
  const approvedIds = new Set(approvals.flatMap((a) => a.findingIds));

  return (
    <>
      <p><Link href="/">← All tickets</Link></p>
      <div className="panel">
        <h2>{ticket.subject} <span className="pill">{ticket.status}</span></h2>
        <p>{ticket.body}</p>
        <p className="small muted">Goal: {ticket.goal}</p>
        <p className="small muted">Target: <code>{ticket.targetUrl}</code>
          {ticket.voiceNotePath && <> · Voice note (<code>{ticket.voiceNotePath}</code>, transcription pending M4)<br /><audio controls src={`/api/${ticket.voiceNotePath}`} style={{ marginTop: 6, maxWidth: "100%" }} /></>}
        </p>
        <RunButtons ticketId={ticket.id} roomId={room.id} targetUrl={ticket.targetUrl} goal={ticket.goal} baselineRunId={baseline?.runId} />
      </div>

      {runViews.length === 0 && (
        <div className="panel"><p className="muted">No runs yet. Press <strong>Run investigation</strong> above, then refresh in about a minute.</p></div>
      )}

      {runViews.map(({ runId, rec, status, findings, verification, report }) => (
        <div className="panel" key={runId}>
          <h2>{rec?.kind === "verify" ? "Verification" : "Investigation"} <span className="pill">{status}</span></h2>
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
              <p><strong>{f.title}</strong> <span className="pill">{f.severity}</span> <span className="pill">{f.category}</span> <span className="pill">{f.analysisSource}</span></p>
              <p className="small"><code>{f.id}</code> · suspected cause: {f.suspectedCause} (confidence: {f.confidence})</p>
              <p className="small">Suggested fix: {f.suggestedFix}</p>
              <ol className="repro">{f.reproSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              {f.evidence.screenshots.map((s) => (
                <img key={s} className="shot" src={`/api/artifacts/${runId}/${s}`} alt={`${f.id} evidence ${s}`} />
              ))}
              <div className="row" style={{ marginTop: 6 }}>
                {approvedIds.has(f.id)
                  ? <span className="pill">fix instruction approved</span>
                  : <ApproveButton roomId={room.id} findingId={f.id} instruction={f.suggestedFix} />}
                <a className="small" href={`/api/artifacts/${runId}/mcp-packets/${f.id}.md`}>fix packet</a>
              </div>
            </div>
          ))}
          {report && (
            <details style={{ marginTop: 10 }}>
              <summary className="small">Full report.md</summary>
              <pre className="report">{report}</pre>
            </details>
          )}
        </div>
      ))}

      <div className="grid2">
        <div className="panel">
          <h2>Room discussion ({messages.length})</h2>
          {messages.length === 0 && <p className="muted small">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.authorType}`}>
              <div className="who">{m.authorName} · {m.createdAt.slice(0, 16).replace("T", " ")}</div>
              <div>{m.body}</div>
            </div>
          ))}
          <MessageForm roomId={room.id} />
        </div>
        <div className="panel">
          <h2>Approved instructions ({approvals.length})</h2>
          {approvals.length === 0 && <p className="muted small">Approve a finding’s fix above to queue it for the coding agent.</p>}
          {approvals.map((a) => (
            <div key={a.id} className="msg">
              <div className="who">{a.approvedBy} · {a.createdAt.slice(0, 16).replace("T", " ")} · <span className="pill">{a.status}</span></div>
              <div className="small"><code>{a.findingIds.join(", ")}</code></div>
              <div>{a.instruction}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
