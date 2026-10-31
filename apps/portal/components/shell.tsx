// Application shell: sidebar navigation + top bar. Client for active states.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { Palette } from "./palette";
import { useState } from "react";

const BUILD: Array<[string, string, string, string]> = [
  ["/", "Home", "grid", "Tickets, runs, status"],
  ["/repos", "Test a repo", "repo", "Connect GitHub, build, deploy"],
  ["/tickets", "Tickets and fixes", "ticket", "Report to verified fix"],
  ["/ux", "UX and redesign", "eye", "UI analysis, new screens"],
  ["/a11y", "Accessibility", "access", "Checks with grades"],
  ["/firstrun", "First run", "play", "New user experience"],
];

const GUARD: Array<[string, string, string, string]> = [
  ["/guardian", "Threats", "shield", "Incidents and response"],
  ["/guardian/work", "Fix tasks", "order", "Approve agent fixes"],
  ["/guardian/security", "Security tests", "lock", "Pen tests and sweeps"],
];

const OPS: Array<[string, string, string, string]> = [
  ["/guardian/signals", "Live signals", "signal", "Production complaints"],
  ["/guardian/night", "Night shift", "moon", "Overnight agent runs"],
  ["/guardian/zoom", "Meet", "video", "Built in video calls"],
];

function active(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/guardian") return path === "/guardian" || /^\/guardian\/[^/]+$/.test(path);
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ env }: { env: string }) {
  const path = usePathname();
  const section = (label: string, links: Array<[string, string, string, string]>) => (
    <>
      <div className="side-section">{label}</div>
      {links.map(([href, label2, icon, desc]) => (
        <Link key={href} href={href} className={`side-link${active(path, href) ? " on" : ""}`}>
          <Icon name={icon} />
          <span>{label2}<span className="side-desc">{desc}</span></span>
        </Link>
      ))}
    </>
  );
  return (
    <aside className="sidebar">
      <Link href="/" className="side-brand">
        <span className="side-mark">C</span>
        <span>
          <span className="side-name">CHARIE</span>
          <div className="side-sub">Autonomous engineering intelligence</div>
        </span>
      </Link>
      {section("Charie Build", BUILD)}
      {section("Charie Guard", GUARD)}
      {section("Charie Ops", OPS)}
      <div className="side-foot">
        <Link href="/settings" className={`side-link${active(path, "/settings") ? " on" : ""}`}>
          <Icon name="gear" />
          Settings
        </Link>
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
          <span className="small muted">ticket → evidence → fix → proof</span>
        </div>
      </div>
      {open && <Palette close={() => setOpen(false)} />}
    </>
  );
}
