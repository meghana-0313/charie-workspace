// Production connection: point Charie at a GCP project, run log watch.

"use client";

import { useState } from "react";
import { Badge } from "./ui";
import type { LogWatchView } from "@/lib/types";

export function LogWatchPanel({ initialProject, initialReport }: { initialProject: string | null; initialReport: LogWatchView | null }) {
  const [project, setProject] = useState(initialProject ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<LogWatchView | null>(initialReport);
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/guardian/logwatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.trim() }),
    });
    const j = (await res.json().catch(() => ({}))) as LogWatchView & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "log watch failed");
      return;
    }
    setReport(j);
  }
  return (
    <div>
      <form onSubmit={run}>
        <div className="row">
          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="GCP project id (blank = this workspace project)"
            aria-label="GCP project id"
            style={{ flex: 1, minWidth: 220 }}
          />
          <button type="submit" disabled={busy}>{busy ? "Watching…" : "Run log watch"}</button>
        </div>
      </form>
      {busy && <p className="muted small">Querying the last 60 minutes of errors…</p>}
      {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      <p className="small muted" style={{ marginTop: 8 }}>
        The engine reads Cloud Logging with its service account; Logging Viewer on the project is enough.
        Find your project id in the project picker at the top of console.cloud.google.com. On hosted Charie this is already wired.
      </p>
      {report && !report.configured && (
        <p className="small muted">Log watch needs GCP (the engine reads Cloud Logging with its service account). Locally it stays off.</p>
      )}
      {report && report.configured && (
        <div style={{ marginTop: 10 }}>
          <p className="small muted">
            {report.total} error(s) in {report.windowMinutes}m on <code>{report.projectId}</code> · top groups feed Live signals automatically
          </p>
          {report.groups.length === 0 ? (
            <p><Badge>quiet</Badge> <span className="small muted">No errors in the window.</span></p>
          ) : (
            <table>
              <thead><tr><th>Signature</th><th>Count</th><th>Sample</th></tr></thead>
              <tbody>
                {report.groups.map((g) => (
                  <tr key={g.signature}>
                    <td className="small"><code>{g.signature}</code></td>
                    <td><Badge>{g.count}x</Badge></td>
                    <td className="small muted">{g.sample || "(empty message)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
