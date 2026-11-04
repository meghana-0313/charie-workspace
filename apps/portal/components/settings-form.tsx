// Workspace settings form: name, default product URL, log watch project,
// and the autopilot master pause. Saves through /api/settings (admin gated).

"use client";

import { useState } from "react";

export interface SettingsValues {
  workspaceName: string;
  defaultTargetUrl: string;
  prodProjectId: string;
  autopilotPaused: string; // "1" | "0"
}

export function SettingsForm({ initial, canEdit }: { initial: SettingsValues; canEdit: boolean }) {
  const [values, setValues] = useState(initial);
  const [paused, setPaused] = useState(initial.autopilotPaused === "1");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");

  const set = (k: keyof SettingsValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function save() {
    if (state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, autopilotPaused: paused }),
      });
      setState(res.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      <label htmlFor="ws-name">Workspace name</label>
      <input id="ws-name" value={values.workspaceName} onChange={set("workspaceName")} placeholder="CHARIE" disabled={!canEdit} />
      <p className="field-hint">Shown in the sidebar and on the login screen.</p>

      <label htmlFor="ws-target">Default product URL</label>
      <input id="ws-target" value={values.defaultTargetUrl} onChange={set("defaultTargetUrl")} placeholder="https://your-app.example.com" disabled={!canEdit} />
      <p className="field-hint">Prefills the target on new tickets and scans. Each form still lets you override it.</p>

      <label htmlFor="ws-project">Production GCP project (log watch)</label>
      <input id="ws-project" value={values.prodProjectId} onChange={set("prodProjectId")} placeholder="my-gcp-project" disabled={!canEdit} />
      <p className="field-hint">Charie reads this project's error logs on the Threats page. Same setting the log watch uses.</p>

      <div className="switch-row" style={{ marginTop: 14 }}>
        <input
          id="ws-pause"
          type="checkbox"
          checked={paused}
          disabled={!canEdit}
          onChange={(e) => setPaused(e.target.checked)}
          style={{ width: "auto" }}
        />
        <label htmlFor="ws-pause" style={{ margin: 0 }}>Pause autopilot</label>
      </div>
      <p className="field-hint">When paused, schedules stay listed but the scheduler runs nothing. Manual runs still work.</p>

      <div className="row" style={{ marginTop: 14 }}>
        <button onClick={save} disabled={!canEdit || state === "busy"}>
          {state === "busy" ? "Saving…" : "Save settings"}
        </button>
        {state === "saved" && <span className="small" style={{ color: "var(--ok)" }}>Saved.</span>}
        {state === "error" && <span className="small" style={{ color: "var(--danger)" }}>Save failed (admins only, and URLs must be valid).</span>}
        {!canEdit && <span className="small muted">Only workspace admins can change these.</span>}
      </div>
    </div>
  );
}
