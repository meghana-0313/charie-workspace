// Get-started checklist for new accounts. Stays until the three first-run
// jobs are done (repo, ticket, run), and can be dismissed per browser.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row between">
        <strong>Get started</strong>
        <button
          type="button"
          className="ghost sm"
          onClick={() => {
            localStorage.setItem("charie-onboard-off", "1");
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
      <div className="stack" style={{ marginTop: 8 }}>
        {steps.map((s) => (
          <p key={s.label} className="small">
            {s.done ? <span className="proof-pass">done</span> : <span className="muted">todo</span>}{" "}
            <Link href={s.href}>{s.label}</Link> <span className="muted">({s.hint})</span>
          </p>
        ))}
      </div>
    </div>
  );
}
