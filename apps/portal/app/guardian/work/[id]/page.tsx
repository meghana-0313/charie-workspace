import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkOrder } from "@/lib/guardian";
import { SuiteNav } from "@/components/suite-nav";
import { NightShiftButton, WorkOrderButtons } from "@/components/suite";

export const dynamic = "force-dynamic";

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wo = await getWorkOrder(id);
  if (!wo) notFound();
  return (
    <>
      <p><Link href="/guardian/work">← Work orders</Link></p>
      <SuiteNav current="/guardian/work" />
      <div className="panel">
        <h2>{wo.title} <span className="pill">{wo.status}</span> <span className="pill">{wo.risk} risk</span></h2>
        <p className="small muted">
          Source: {wo.source} <code>{wo.sourceRef}</code> · Created {wo.createdAt.slice(0, 16).replace("T", " ")}
          {wo.scheduledFor && <> · Scheduled for {wo.scheduledFor.slice(0, 16).replace("T", " ")}</>}
        </p>
        {wo.approvals.length > 0 && (
          <p className="small">Approvals: {wo.approvals.map((a) => `${a.by} at ${a.at.slice(0, 16).replace("T", " ")}`).join("; ")}</p>
        )}
        <WorkOrderButtons id={wo.id} status={wo.status} />
      </div>
      <div className="panel">
        <h2>Plan ({wo.plan.length} steps)</h2>
        <ol className="repro">
          {wo.plan.map((s, i) => (
            <li key={i}>
              <span className="pill">{s.kind}</span> {s.label} <code>{s.ref}</code>
              {s.targetUrl && <span className="small muted"> · {s.targetUrl}{s.baselineRunId ? ` vs ${s.baselineRunId.slice(0, 19)}` : ""}</span>}
            </li>
          ))}
        </ol>
      </div>
      <div className="panel">
        <h2>Proofs ({wo.proofs.length})</h2>
        {wo.proofs.length === 0 ? (
          <p className="muted small">
            No proofs yet. Proofs land here when Night Shift executes this order.{" "}
            {(wo.status === "approved" || wo.status === "scheduled") && "Press Run now above to demo it live."}
          </p>
        ) : (
          <ul className="small">
            {wo.proofs.map((p, i) => (
              <li key={i}>
                <span className={p.ok ? "proof-pass" : "proof-fail"}>{p.ok ? "PASS" : "FAIL"}</span>{" "}
                {p.step}: {p.detail}
                {p.artifact && <> <code>{p.artifact}</code></>}
              </li>
            ))}
          </ul>
        )}
        {(wo.status === "approved" || wo.status === "scheduled") && (
          <div style={{ marginTop: 10 }}><NightShiftButton orderIds={[wo.id]} /></div>
        )}
      </div>
    </>
  );
}
