// Get-started checklist for new accounts. Stays until the three first-run
// jobs are done (repo, ticket, run), and can be dismissed per browser.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

export function GetStarted({ hasRepo, hasTicket, hasRun }: { hasRepo: boolean; hasTicket: boolean; hasRun: boolean }) {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(localStorage.getItem("charie-onboard-off") === "1");
  }, []);
  if ((hasRepo && hasTicket && hasRun) || dismissed) return null;
  const steps = [
    { done: hasRepo, label: "Connect a GitHub repo", href: "/repos", hint: "one click sign-in or a token" },
    { done: hasTicket, label: "File a ticket, or pull from Jira in Integrations", href: "/tickets", hint: "describe the issue, attach a URL" },
    { done: hasRun, label: "Watch a run prove the fix", href: "/tickets", hint: "evidence first, verify before merge" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="onboard-head">
        <span className="onboard-icon"><Icon name="spark" size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>Get started - {doneCount} of {steps.length} done</strong>
          <div className="small muted">Connect a repo, file a ticket, watch Charie prove a fix. About 2 minutes.</div>
        </div>
        <button
          type="button"
          className="ghost sm dismiss-x"
          aria-label="Dismiss get started checklist"
          title="Dismiss"
          onClick={() => {
            localStorage.setItem("charie-onboard-off", "1");
            setDismissed(true);
          }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="onboard-progress" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Get started progress">
        <i style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <div className="stack" style={{ marginTop: 10 }}>
        {steps.map((s) => (
          <p key={s.label} className="small row" style={{ flexWrap: "nowrap" }}>
            <span className={`check-dot ${s.done ? "done" : "todo"}`} role="img" aria-label={s.done ? "Done" : "To do"}>
              {s.done ? <Icon name="check" size={12} /> : ""}
            </span>
            <span>
              <Link href={s.href}>{s.label}</Link> <span className="muted">({s.hint})</span>
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
