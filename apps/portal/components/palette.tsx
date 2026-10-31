// Command palette: fuzzy jump to any section. Static index, no backend needed.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const COMMANDS: Array<[string, string, string]> = [
  ["Home", "/", "dashboard, overview, tickets"],
  ["Test a repo", "/repos", "github, connect, build, repositories"],
  ["Tickets and fixes", "/tickets", "report, bug, verify"],
  ["UX and redesign", "/ux", "design, screens, usability, mockup"],
  ["Accessibility", "/a11y", "a11y, contrast, labels, wcag"],
  ["First run", "/firstrun", "onboarding, new user, landing"],
  ["Threats", "/guardian", "incidents, monitoring, runtime"],
  ["Fix tasks", "/guardian/work", "remediation, approve, work orders"],
  ["Security tests", "/guardian/security", "pentest, headers, tls"],
  ["Live signals", "/guardian/signals", "support, inbox, sentiment, complaints"],
  ["Night shift", "/guardian/night", "overnight, digest, autonomous"],
  ["Meet", "/guardian/zoom", "video, call, standup, zoom"],
  ["Settings", "/settings", "environment, integrations"],
  ["New ticket", "/#new-ticket", "file, report, bug"],
];

export function Palette({ close }: { close: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return COMMANDS;
    return COMMANDS.filter(([label, , keys]) => `${label} ${keys}`.toLowerCase().includes(needle));
  }, [q]);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, hits.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && hits[idx]) {
        router.push(hits[idx][1]);
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, hits, idx, router]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    const onCombo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onCombo);
    return () => window.removeEventListener("keydown", onCombo);
  }, [close]);

  return (
    <div className="palette-backdrop" onClick={close}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a section or action…" />
        <div className="palette-list">
          {hits.length === 0 && <div className="small muted" style={{ padding: 10 }}>No matches.</div>}
          {hits.map(([label, href, keys], i) => (
            <button
              key={href}
              className={`palette-item${i === idx ? " on" : ""}`}
              onClick={() => {
                router.push(href);
                close();
              }}
              onMouseEnter={() => setIdx(i)}
            >
              {label}
              <span className="hint">{keys.split(",")[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
