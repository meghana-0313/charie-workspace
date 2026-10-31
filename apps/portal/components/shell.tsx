// Application shell: sidebar navigation + top bar. Client for active states.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { Palette } from "./palette";
import { useState } from "react";

const BUILD: Array<[string, string, string]> = [
  ["/", "Overview", "grid"],
  ["/repos", "Repositories", "repo"],
];

const RUNTIME: Array<[string, string, string]> = [
  ["/guardian", "Guardian", "shield"],
  ["/guardian/work", "Work Orders", "order"],
  ["/guardian/signals", "Signals", "signal"],
  ["/guardian/night", "Night Shift", "moon"],
  ["/guardian/security", "Security", "lock"],
  ["/guardian/zoom", "Meetings", "video"],
];

function active(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/guardian") return path === "/guardian" || /^\/guardian\/[^/]+$/.test(path);
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ env }: { env: string }) {
  const path = usePathname();
  const section = (label: string, links: Array<[string, string, string]>) => (
    <>
      <div className="side-section">{label}</div>
      {links.map(([href, label2, icon]) => (
        <Link key={href} href={href} className={`side-link${active(path, href) ? " on" : ""}`}>
          <Icon name={icon} />
          {label2}
        </Link>
      ))}
    </>
  );
  return (
    <aside className="sidebar">
      <Link href="/" className="side-brand">
        <span className="side-mark">C</span>
        <span>
          <span className="side-name">Agent CB</span>
          <div className="side-sub">GhostQA Suite</div>
        </span>
      </Link>
      {section("Build Intelligence", BUILD)}
      {section("Runtime Intelligence", RUNTIME)}
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
