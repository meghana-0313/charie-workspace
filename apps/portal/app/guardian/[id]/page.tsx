import Link from "next/link";
import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { RespondForm, VerifyButton } from "@/components/guardian-forms";

export const dynamic = "force-dynamic";

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inc = await store.getIncident(id);
  if (!inc) notFound();
  const defaultTarget = inc.signals[0]?.ips[0] ?? inc.signals[0]?.actors[0] ?? "";

  return (
    <>
      <p><Link href="/guardian">← All incidents</Link></p>
      <div className="panel">
        <h2>{inc.title} <span className="pill">{inc.severity}</span> <span className="pill">{inc.status}</span></h2>
        <p className="small muted">
          <span className="pill">simulated</span> Opened {inc.createdAt.slice(0, 16).replace("T", " ")} ·
          mode: {inc.mode} · baseline suspicious events: {inc.baselineSuspicious}
        </p>
        {inc.investigation ? (
          <>
            <h3>AI investigation</h3>
            <p><strong>{inc.investigation.verdict}</strong></p>
            <p>{inc.investigation.summary}</p>
            <h3>Timeline</h3>
            <ol className="repro">{inc.investigation.timeline.map((t, i) => <li key={i}>{t}</li>)}</ol>
            <h3>Recommended response</h3>
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
            Signals only - no AI investigation{inc.mode === "signals-only" ? " (engine unreachable or no API keys; detectors still work)" : ""}.
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Signals ({inc.signals.length})</h2>
        {inc.signals.map((s, i) => (
          <div key={i} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
            <p><strong>{s.title}</strong> <span className="pill">{s.type}</span> <span className="pill">{s.severity}</span></p>
            <ul className="small">{s.evidence.map((e, j) => <li key={j}>{e}</li>)}</ul>
            <p className="small muted">actors: {s.actors.join(", ") || "unknown"} · ips: {s.ips.join(", ") || "unknown"}</p>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>Respond ({inc.actions.length})</h2>
          <p className="small muted">Approved actions execute against the simulation, then verify against a fresh window.</p>
          <RespondForm incidentId={inc.id} defaultTarget={defaultTarget} />
          <div style={{ marginTop: 10 }}>
            <VerifyButton incidentId={inc.id} />
          </div>
          {inc.actions.map((a) => (
            <div key={a.id} className="msg">
              <div className="who">{a.action} on {a.target} · {a.at.slice(0, 16).replace("T", " ")} · <span className="pill">{a.status}</span></div>
              <div className="small">{a.detail}</div>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>Incident report</h2>
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
    </>
  );
}
