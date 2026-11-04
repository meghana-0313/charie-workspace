import { notFound } from "next/navigation";
import { identity, scopeUid } from "@/lib/who";
import { getWorkOrder } from "@/lib/guardian";
import { NightShiftButton, WorkOrderButtons } from "@/components/suite";
import { Badge, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wo = await getWorkOrder(id, scopeUid(await identity()));
  if (!wo) notFound();
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/work", "Fix tasks"], [`/guardian/work/${wo.id}`, wo.id]]}
        title={<>{wo.title} <Badge tone={wo.status}>{wo.status}</Badge> <Badge tone={wo.risk}>{wo.risk} risk</Badge></>}
        sub={<>Source: {wo.source} <code>{wo.sourceRef}</code> · Created {wo.createdAt.slice(0, 16).replace("T", " ")}
          {wo.scheduledFor && <> · Scheduled for {wo.scheduledFor.slice(0, 16).replace("T", " ")}</>}</>}
        actions={<WorkOrderButtons id={wo.id} status={wo.status} />}
      />
      {wo.approvals.length > 0 && (
        <div className="card">
          <div className="card-title">Approvals</div>
          <p className="small">{wo.approvals.map((a) => `${a.by} at ${a.at.slice(0, 16).replace("T", " ")}`).join("; ")}</p>
        </div>
      )}
      <div className="card">
        <div className="card-title">Plan ({wo.plan.length} steps)</div>
        <ol className="repro">
          {wo.plan.map((s, i) => (
            <li key={i}>
              <Badge>{s.kind}</Badge> {s.label} <code>{s.ref}</code>
              {s.targetUrl && <span className="small muted"> · {s.targetUrl}{s.baselineRunId ? ` vs ${s.baselineRunId.slice(0, 19)}` : ""}</span>}
            </li>
          ))}
        </ol>
      </div>
      <div className="card">
        <div className="card-title">Proofs ({wo.proofs.length})</div>
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
