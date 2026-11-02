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

function useScan<T>(path: string) {
  const [url, setUrl] = useState("");
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

export function UxReviewButton() {
  const [url, setUrl] = useState("");
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
      await post("/api/runs", { ticketId: tkt.id, roomId: tkt.roomId, kind: "investigate", targetUrl: tkt.targetUrl, goal: tkt.goal });
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

export function A11yRunForm() {
  const { url, setUrl, busy, error, report, run } = useScan<A11yView>("/api/guardian/a11y");
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

export function FirstRunForm() {
  const { url, setUrl, busy, error, report, run } = useScan<FirstRunView>("/api/guardian/firstrun");
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
