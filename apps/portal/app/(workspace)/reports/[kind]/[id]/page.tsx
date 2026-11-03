import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportDetail } from "@/lib/reports";
import { identity, scopeUid } from "@/lib/who";

const NR = "Not Recorded";

function Row({ k, v }: { k: string; v?: string | number | null }) {
  return (
    <p className="small row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
      <span className="muted">{k}</span>
      <strong style={{ textAlign: "right" }}>{v === undefined || v === null || v === "" ? NR : v}</strong>
    </p>
  );
}

interface CheckRow { name: string; pass: boolean; evidence: string; severity?: string; owasp?: string }

export default async function ReportPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const uid = scopeUid(await identity());
  const report = await getReportDetail(kind, id, uid);
  if (!report) notFound();
  const payload = (report.payload ?? {}) as Record<string, unknown>;
  const checks = (payload.checks ?? payload.steps) as CheckRow[] | undefined;
  const usecase =
    report.kind === "pentest" ? "Checks whether the target is safe to expose: headers, cookies, auth boundaries, and common web attacks."
    : report.kind === "a11y" ? "Checks whether people using keyboards, screen readers, or low vision can actually use the page."
    : report.kind === "firstrun" ? "Walks the product like a brand-new user to find where first-time journeys break."
    : report.kind === "incident" ? "Explains a production threat signal: what happened, how bad it is, and what to do."
    : "Investigates or verifies a ticket by driving the real product and collecting evidence.";

  return (
    <div>
      <p className="small"><Link href="/reports">← All reports</Link></p>
      <div className="page-head">
        <h1>{report.title}</h1>
        <p className="page-sub">{report.kindLabel} · {report.at.slice(0, 16).replace("T", " ")} · <span className="mono">{report.id}</span></p>
      </div>

      <div className="card">
        <div className="card-title">Overview</div>
        <Row k="Report type" v={report.kindLabel} />
        <Row k="Status" v={report.status} />
        <Row k="Result" v={report.result} />
        <Row k="Severity" v={report.severity} />
        <Row k="Date" v={report.at} />
      </div>

      <div className="card">
        <div className="card-title">Usecase</div>
        <p className="small" style={{ margin: 0 }}>{usecase}</p>
      </div>

      <div className="card">
        <div className="card-title">Inputs Received</div>
        <Row k="Target" v={report.target} />
        <Row k="Report ID" v={report.id} />
        <Row k="Record inputs" v={checks ? `${checks.length} checks defined` : undefined} />
      </div>

      <div className="card">
        <div className="card-title">Execution Details</div>
        {checks ? (
          <div className="stack">
            {checks.map((c, i) => (
              <p key={i} className="small row" style={{ flexWrap: "nowrap" }}>
                <span className={`check-dot ${c.pass ? "done" : "todo"}`}>{c.pass ? "✓" : "!"}</span>
                <span><strong>{c.name}</strong>{c.owasp ? <span className="muted"> ({c.owasp})</span> : null}<br /><span className="muted">{c.evidence || NR}</span></span>
              </p>
            ))}
          </div>
        ) : report.incident ? (
          <div className="stack">
            {(report.incident.investigation?.timeline ?? []).map((t, i) => <p key={i} className="small" style={{ margin: 0 }}>{t}</p>)}
            {(report.incident.investigation?.timeline ?? []).length === 0 && <p className="small muted" style={{ margin: 0 }}>{NR}</p>}
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>{report.reportMd ? "See the output below." : NR}</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">Diagnosis / Analysis</div>
        {report.incident?.investigation ? (
          <>
            <Row k="Verdict" v={report.incident.investigation.verdict} />
            <p className="small" style={{ margin: "8px 0 0" }}>{report.incident.investigation.summary}</p>
          </>
        ) : report.findings && report.findings.length > 0 ? (
          <div className="stack">
            {report.findings.map((f) => (
              <p key={f.id} className="small" style={{ margin: 0 }}>
                <strong>{f.title}</strong> <span className={`sev ${f.severity}`}>{f.severity}</span><br />
                <span className="muted">{f.suspectedCause || NR}</span>
                {f.analysisSource && <span className="muted"> · analysis: {f.analysisSource}</span>}
              </p>
            ))}
          </div>
        ) : checks ? (
          <p className="small" style={{ margin: 0 }}>{checks.filter((c) => !c.pass).length} of {checks.length} checks failed. Each failure above carries its own evidence.</p>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>{NR}</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">Outputs Generated</div>
        {report.reportMd ? (
          <pre className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{report.reportMd.slice(0, 12000)}</pre>
        ) : report.incident ? (
          <div className="stack">
            {(report.incident.investigation?.plan ?? []).map((p, i) => <p key={i} className="small" style={{ margin: 0 }}>{p}</p>)}
            {(report.incident.investigation?.plan ?? []).length === 0 && <p className="small muted" style={{ margin: 0 }}>{NR}</p>}
          </div>
        ) : (
          <p className="small" style={{ margin: 0 }}>{report.result}</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">Execution Metadata</div>
        <Row k="Report ID" v={report.id} />
        <Row k="Kind" v={report.kind} />
        <Row k="Failed items" v={report.failedCount} />
        <Row k="Model" v={report.kind === "incident" ? NR : undefined} />
        <Row k="Raw record" v="Available in the source system of record" />
        <details>
          <summary className="small" style={{ cursor: "pointer" }}>Raw payload</summary>
          <pre className="small mono" style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(report.payload, null, 2).slice(0, 8000)}</pre>
        </details>
      </div>
    </div>
  );
}
