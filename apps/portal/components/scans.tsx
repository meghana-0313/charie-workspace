// On demand scan forms: accessibility and first run. Posts a target URL,
// renders the report inline. History below stays server rendered.

"use client";

import { useState } from "react";
import { Badge } from "./ui";
import type { A11yView, FirstRunView } from "@/lib/types";

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

function urlError(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Use an http(s) URL, e.g. https://your-app.example.com";
    return "";
  } catch {
    return "Enter a full URL, e.g. https://your-app.example.com";
  }
}

/**
 * Auto-appearing executor tooltip (DAP style): after every finished scan,
 * it names who actually executed the run, what was scanned, and dismisses
 * only when the user closes it. For investigations the same pattern shows
 * the Meta model from the report; scans name the engine honestly, since
 * they are deterministic browser checks, not AI grading.
 */
export function ExecutorTip({ executor, target, model }: { executor?: string; target?: string; model?: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const who = model ? `Meta model: ${model}` : (executor ?? "Charie engine (deterministic checks, no AI grading)");
  return (
    <div role="status" aria-live="polite" className="card" style={{ borderColor: "var(--accent, #6ee7d8)", background: "rgba(110,231,216,.08)", padding: "10px 12px", marginTop: 10, position: "relative" }}>
      <button type="button" className="ghost sm" aria-label="Dismiss executor tip" onClick={() => setOpen(false)} style={{ position: "absolute", right: 6, top: 6 }}>x</button>
      <p className="small" style={{ margin: 0 }}><strong>Run finished.</strong> Executed by {who}{target ? <> against <code>{target}</code></> : ""}.</p>
      <p className="small muted" style={{ margin: "4px 0 0" }}>Findings investigated by Charie name their Meta model in the report. Deterministic scans are never relabelled as AI runs.</p>
    </div>
  );
}

function useScan<T>(path: string, defaultUrl = "") {
  const [url, setUrl] = useState(defaultUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<T | null>(null);
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    const bad = urlError(url.trim());
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    setError("");
    setReport(null);
    const r = await post(path, { targetUrl: url.trim() });
    setBusy(false);
    if (!r.ok) {
      setError(String(r.data.error ?? "scan failed"));
      return;
    }
    setReport(r.data as unknown as T);
  }
  return { url, setUrl, busy, error, report, run };
}

function UrlRow({ url, setUrl, busy, label }: { url: string; setUrl: (v: string) => void; busy: boolean; label: string }) {
  return (
    <div className="row">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://your-app.example.com"
        aria-label="Target URL"
        style={{ flex: 1, minWidth: 220 }}
      />
      <button type="submit" disabled={busy}>{busy ? "Scanning…" : label}</button>
    </div>
  );
}

export function UxReviewButton({ defaultTarget = "" }: { defaultTarget?: string }) {
  const [url, setUrl] = useState(defaultTarget);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(e: React.FormEvent) {
    e.preventDefault();
    const target = url.trim();
    if (!target || busy) return;
    const bad = urlError(target);
    if (bad) {
      setError(bad);
      return;
    }
    setBusy(true);
    setError("");
    try {
      let host = target;
      try {
        host = new URL(target).host;
      } catch {
        /* keep raw */
      }
      const fd = new FormData();
      fd.set("subject", `UX review of ${host}`);
      fd.set("body", `Review the user experience of ${target}: clarity, flow, and friction.`);
      fd.set("goal", `Walk the core journey of ${target} as a new user and flag every usability issue with evidence.`);
      fd.set("targetUrl", target);
      const created = await fetch("/api/tickets", { method: "POST", body: fd });
      if (!created.ok) throw new Error("ticket failed");
      const tkt = (await created.json()) as { id: string; roomId: string; targetUrl: string; goal: string };
      const runRes = await post("/api/runs", { ticketId: tkt.id, roomId: tkt.roomId, kind: "investigate", targetUrl: tkt.targetUrl, goal: tkt.goal });
      if (!runRes.ok) {
        setBusy(false);
        const err = String(runRes.data.error ?? "");
        setError(err.includes("429") || err.includes("busy")
          ? "The ticket was filed, but the investigation did not start: the engine is busy with another run. Open the ticket and press Run investigation when it frees up."
          : `The ticket was filed, but the investigation did not start: ${err || "engine unreachable"}. Open the ticket from Tickets and run it there.`);
        return;
      }
      location.href = `/tickets/${tkt.id}`;
    } catch {
      setBusy(false);
      setError("Could not start the review. Check the URL and retry.");
    }
  }
  return (
    <div>
      <form onSubmit={run}>
        <div className="row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-app.example.com"
            aria-label="Target URL"
            style={{ flex: 1, minWidth: 220 }}
          />
          <button type="submit" disabled={busy}>{busy ? "Starting…" : "Start UX review"}</button>
        </div>
      </form>
      {busy && <p className="muted small">Filing the ticket and driving the app…</p>}
      {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      <p className="muted small">One click files the ticket, runs the investigation, and opens the ticket with the evidence brief.</p>
    </div>
  );
}

export function A11yRunForm({ defaultTarget = "" }: { defaultTarget?: string }) {
  const { url, setUrl, busy, error, report, run } = useScan<A11yView>("/api/guardian/a11y", defaultTarget);
  return (
    <div>
      <p className="muted small">Checks the page in a real browser: labels, contrast, keyboard order, landmarks, and more, each graded with evidence.</p>
      <form onSubmit={run}>
        <UrlRow url={url} setUrl={setUrl} busy={busy} label="Run accessibility scan" />
      </form>
      {busy && <p className="muted small">Driving the page in a real browser…</p>}
      {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      {report && (
        <div style={{ marginTop: 10 }}>
          <ExecutorTip key={report.id} executor={report.executor} target={report.targetUrl} />
          <p><Badge tone={`grade-${report.grade}`}>{report.grade}</Badge> <span className="small muted">{report.passed}/{report.checks.length} checks passed · <code>{report.targetUrl}</code></span></p>
          <table>
            <thead><tr><th>Check</th><th>Severity</th><th>Result</th><th>Evidence</th></tr></thead>
            <tbody>
              {report.checks.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><Badge>{c.severity}</Badge></td>
                  <td>{c.pass ? <span className="proof-pass">pass</span> : <span style={{ color: "var(--danger)", fontWeight: 700 }}>fail</span>}</td>
                  <td className="small muted">{c.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FirstRunForm({ defaultTarget = "" }: { defaultTarget?: string }) {
  const { url, setUrl, busy, error, report, run } = useScan<FirstRunView>("/api/guardian/firstrun", defaultTarget);
  return (
    <div>
      <p className="muted small">Loads the site as a brand new visitor on desktop and mobile: speed, first paint, tap targets, and whether the first screen explains itself.</p>
      <form onSubmit={run}>
        <UrlRow url={url} setUrl={setUrl} busy={busy} label="Run first run test" />
      </form>
      {busy && <p className="muted small">Loading as a new visitor, desktop and mobile…</p>}
      {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      {report && (
        <div style={{ marginTop: 10 }}>
          <ExecutorTip key={report.id} executor={report.executor} target={report.targetUrl} />
          <p><strong style={{ fontSize: "var(--text-xl)" }}>{report.score}/100</strong> <span className="small muted">{report.passed}/{report.steps.length} steps passed · <code>{report.targetUrl}</code></span></p>
          <table>
            <thead><tr><th>Step</th><th>Result</th><th>Evidence</th></tr></thead>
            <tbody>
              {report.steps.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.pass ? <span className="proof-pass">pass</span> : <span style={{ color: "var(--danger)", fontWeight: 700 }}>fail</span>}</td>
                  <td className="small muted">{s.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
