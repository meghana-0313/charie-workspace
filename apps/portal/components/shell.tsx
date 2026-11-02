// Application shell: sidebar navigation + top bar. Client for active states.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { CharieMark } from "./mark";
import { Palette } from "./palette";
import { LogoutButton, ThemeToggle } from "./theme";
import { useEffect, useState } from "react";

type NavLink = [string, string, string, string];

// The five jobs a first-time user comes for; everything else lives in More.
const PRIMARY: NavLink[] = [
  ["/", "Home", "grid", "Tickets, runs, status"],
  ["/chat", "Chat", "chat", "Talk to Charie"],
  ["/repos", "Test a repo", "repo", "Connect GitHub, build, deploy"],
  ["/tickets", "Tickets and fixes", "ticket", "Report to verified fix"],
  ["/guardian/zoom", "Meet", "video", "Built in video calls"],
];

const MORE: NavLink[] = [
  ["/ux", "UX and redesign", "eye", "UI analysis, new screens"],
  ["/a11y", "Accessibility", "access", "Checks with grades"],
  ["/firstrun", "First run", "play", "New user experience"],
  ["/agents", "Coding agents", "agent", "Hand fixes to AI"],
  ["/guardian", "Incidents", "shield", "Live threats and response"],
  ["/guardian/work", "Fix tasks", "order", "Approve agent fixes"],
  ["/guardian/security", "Security tests", "lock", "Pen tests and sweeps"],
  ["/guardian/signals", "Production signals", "signal", "What users report live"],
  ["/guardian/night", "Overnight runs", "moon", "Agents work while you sleep"],
  ["/autopilot", "Autopilot", "clock", "Schedules that run alone"],
  ["/marketplace", "Integrations", "plug", "Jira, rules, context"],
];

const GUARDIAN_SECTIONS = ["work", "security", "signals", "night", "zoom"];

function active(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/guardian") {
    if (path === "/guardian") return true;
    const m = path.match(/^\/guardian\/([^/]+)$/);
    return Boolean(m && !GUARDIAN_SECTIONS.includes(m[1]));
  }
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ env, workspaceName }: { env: string; workspaceName?: string }) {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (MORE.some(([href]) => active(path, href))) setMoreOpen(true);
  }, [path]);
  const link = ([href, label, icon, desc]: NavLink) => (
    <Link key={href} href={href} className={`side-link${active(path, href) ? " on" : ""}`}>
      <Icon name={icon} />
      <span>{label}<span className="side-desc">{desc}</span></span>
    </Link>
  );
  return (
    <aside className="sidebar">
      <Link href="/" className="side-brand">
        <span className="side-mark"><CharieMark /></span>
        <span>
          <span className="side-name">{workspaceName ?? "CHARIE"}</span>
          <div className="side-sub">Autonomous engineering intelligence</div>
        </span>
      </Link>
      {PRIMARY.map(link)}
      <details className="nav-more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary className="side-section">More tools</summary>
        {MORE.map(link)}
      </details>
      <div className="side-foot">
        <Link href="/team" className={`side-link${active(path, "/team") ? " on" : ""}`}>
          <Icon name="users" />
          Team
        </Link>
        <Link href="/settings" className={`side-link${active(path, "/settings") ? " on" : ""}`}>
          <Icon name="gear" />
          Settings
        </Link>
        <LogoutButton />
        <span className={`env${env === "Development" ? " env-dev" : ""}`}>
          <span className="env-dot" />
          {env}
        </span>
      </div>
    </aside>
  );
}

export function Topbar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="topbar">
        <button className="search-trigger" onClick={() => setOpen(true)} aria-label="Search and commands">
          <Icon name="search" size={14} />
          <span className="txt">Search or jump to…</span>
          <span className="spacer" />
          <span className="kbd">⌘K</span>
        </button>
        <div className="topbar-right">
          <ThemeToggle />
        </div>
      </div>
      {open && <Palette close={() => setOpen(false)} />}
    </>
  );
}
