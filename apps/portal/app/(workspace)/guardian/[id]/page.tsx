import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { RespondForm, VerifyButton } from "@/components/guardian-forms";
import { IncidentVoiceForm, ProposeWorkOrderButton, RollbackButton } from "@/components/suite";
import { Icon } from "@/components/icons";
import { Badge, PageHead, Timeline } from "@/components/ui";

export const dynamic = "force-dynamic";

const STEPS = ["Detected", "Investigating", "Contained", "Verified"];

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inc = await store.getIncident(id);
  if (!inc) notFound();
  const defaultTarget = inc.signals[0]?.ips[0] ?? inc.signals[0]?.actors[0] ?? "";
  const stepIdx = inc.status === "resolved" ? 3 : inc.status === "contained" ? 2 : inc.investigation ? 1 : 0;

  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian", "Incidents"], [`/guardian/${inc.id}`, inc.id]]}
        title={<><span className="icon-orb red" style={{ width: 38, height: 38 }}><Icon name="alert" size={19} /></span> {inc.title}</>}
        sub={<>Opened {inc.createdAt.slice(0, 16).replace("T", " ")} · mode: {inc.mode} · baseline suspicious events: {inc.baselineSuspicious} <Badge tone={inc.severity}>{inc.severity}</Badge> <Badge tone={inc.status}>{inc.status}</Badge></>}
      />

      <div className="card" aria-label="Incident progress">
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {STEPS.map((s, i) => (
            <span key={s} className="row" style={{ flexWrap: "nowrap", flex: 1, minWidth: 140 }}>
              <span className={`icon-orb ${i <= stepIdx ? "violet" : ""}`}><Icon name={i < stepIdx || inc.status === "resolved" ? "check" : "clock"} /></span>
              <span className="small"><strong>{s}</strong><br /><span className="muted">{i < stepIdx || inc.status === "resolved" ? "Done" : i === stepIdx ? "In progress" : "Pending"}</span></span>
              {i < STEPS.length - 1 && <span className="progress" style={{ flex: 1 }}><i style={{ width: i < stepIdx ? "100%" : "0%" }} /></span>}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div>
          <div className="card">
            <div className="card-title">AI investigation <Badge>simulated</Badge></div>
            {inc.investigation ? (
              <>
                <p><strong>{inc.investigation.verdict}</strong></p>
                <p>{inc.investigation.summary}</p>
                <div className="section-label">Timeline</div>
                <Timeline items={inc.investigation.timeline} />
                <div className="section-label">Recommended response</div>
                <ol className="repro">{inc.investigation.plan.map((p, i) => <li key={i}>{p}</li>)}</ol>
                {inc.investigation.disagreement && (
                  <p className="small"><strong>Model disagreement:</strong> {inc.investigation.disagreement}</p>
                )}
                {inc.investigation.glimmerFiltered > 0 && (
                  <p className="small muted">Glimmer filtered {inc.investigation.glimmerFiltered} noise signal(s) before investigation.</p>
                )}
              </>
            ) : (
              <p className="muted">
                Signals only, no AI investigation{inc.mode === "signals-only" ? " (engine unreachable or no API keys; detectors still work)" : ""}.
              </p>
            )}
          </div>

          <div className="card">
            <div className="card-title">Evidence: signals ({inc.signals.length})</div>
            {inc.signals.map((s, i) => (
              <div key={i} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                <p><strong>{s.title}</strong> <Badge>{s.type}</Badge> <Badge tone={s.severity}>{s.severity}</Badge></p>
                <ul className="small">{s.evidence.map((e, j) => <li key={j}>{e}</li>)}</ul>
                <p className="small muted">actors: {s.actors.join(", ") || "unknown"} · ips: {s.ips.join(", ") || "unknown"}</p>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <ProposeWorkOrderButton
                title={`Contain incident: ${inc.title}`}
                source="guardian"
                sourceRef={inc.id}
                plan={[
                  { kind: "re-analyze", label: `Re-scan services after containment of ${inc.id}`, ref: inc.id },
                  { kind: "docs-note", label: "Draft post-incident remediation note", ref: inc.id },
                  { kind: "evidence-pack", label: "Assemble evidence pack", ref: inc.id },
                ]}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title">Voice briefs</div>
            <p className="small muted">Report incident details by voice. Transcribed via Muse Voice and pinned here.</p>
            {inc.voiceBrief && <pre className="report">{inc.voiceBrief}</pre>}
            <div style={{ marginTop: 8 }}><IncidentVoiceForm incidentId={inc.id} /></div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">Respond ({inc.actions.length})</div>
            <p className="small muted">Approved actions execute against the simulation, then verify against a fresh window.</p>
            <RespondForm incidentId={inc.id} defaultTarget={defaultTarget} />
            <div style={{ marginTop: 10 }}>
              <VerifyButton incidentId={inc.id} />
            </div>
            {inc.actions.map((a) => (
              <div key={a.id} className="msg">
                <div className="who">{a.action} on {a.target} · {a.at.slice(0, 16).replace("T", " ")} · <Badge>{a.status}</Badge></div>
                <div className="small">{a.detail}</div>
                {a.status !== "rolled-back" && (
                  <div style={{ marginTop: 6 }}><RollbackButton incidentId={inc.id} actionId={a.id} /></div>
                )}
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Incident report</div>
            <pre className="report">
{`INCIDENT ${inc.id} (SIMULATED)
Severity: ${inc.severity} · Status: ${inc.status}
${inc.investigation ? `Verdict: ${inc.investigation.verdict}\n\n${inc.investigation.summary}\n` : "Signals only, no AI verdict.\n"}
Signals:
${inc.signals.map((s) => `- [${s.severity}] ${s.title}`).join("\n") || "- none"}
${inc.investigation ? `\nPlan:\n${inc.investigation.plan.map((p) => `- ${p}`).join("\n")}` : ""}
${inc.actions.length > 0 ? `\nActions:\n${inc.actions.map((a) => `- ${a.action} ${a.target} (${a.status})`).join("\n")}` : "\nNo actions taken yet."}
`}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}
