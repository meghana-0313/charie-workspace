// Application shell: grouped sidebar (reference IA) + context topbar.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { CharieMark } from "./mark";
import { Palette } from "./palette";
import { LogoutButton, ThemeToggle } from "./theme";
import { useState } from "react";

type NavLink = [string, string, string, number?];

const SECTIONS: Array<[string, NavLink[]]> = [
  ["WORKSPACE", [
    ["/", "Overview", "home"],
    ["/chat", "Chat with Charie", "chat"],
    ["/repos", "Repositories", "layers"],
  ]],
  ["OPERATIONS", [
    ["/tickets", "Tickets & Fixes", "ticket"],
    ["/guardian", "Incidents", "alert"],
    ["/guardian", "Threats", "shield"],
    ["/guardian/security", "Security Tests", "lock"],
    ["/guardian/work", "Fix Tasks", "order"],
  ]],
  ["AUTOMATION", [
    ["/agents", "Coding Agents", "code"],
    ["/autopilot", "Autopilot", "bolt"],
    ["/guardian/signals", "Live Signals", "signal"],
    ["/guardian/night", "Night Shift", "moon"],
  ]],
  ["COLLABORATION", [
    ["/guardian/zoom", "Meet (War Rooms)", "video"],
    ["/ux", "UX & Redesign", "eye"],
    ["/a11y", "Accessibility", "access"],
    ["/firstrun", "First Run", "play"],
  ]],
  ["INTEGRATIONS", [
    ["/marketplace", "Integrations", "plug"],
  ]],
  ["WORKSPACE", [
    ["/team", "Team", "users"],
    ["/settings", "Settings", "gear"],
  ]],
];

function active(path: string, href: string, label: string): boolean {
  if (href === "/") return path === "/";
  if (label === "Incidents") return path === "/guardian" || /^\/guardian\/[^/]+$/.test(path) && !path.startsWith("/guardian/work") && !path.startsWith("/guardian/security") && !path.startsWith("/guardian/signals") && !path.startsWith("/guardian/night") && !path.startsWith("/guardian/zoom");
  if (label === "Threats") return false;
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ env, workspaceName, ticketsOpen, incidentsOpen }: {
  env: string; workspaceName?: string; ticketsOpen?: number; incidentsOpen?: number;
}) {
  const path = usePathname();
  const badge = (label: string) => label === "Tickets & Fixes" && ticketsOpen ? ticketsOpen : label === "Incidents" && incidentsOpen ? incidentsOpen : undefined;
  return (
    <aside className="sidebar">
      <Link href="/" className="side-brand">
        <span className="side-mark"><CharieMark /></span>
        <span>
          <span className="side-name">{workspaceName ?? "CHARIE"}</span>
          <div className="side-sub">Autonomous Engineering Intelligence</div>
        </span>
      </Link>
      {SECTIONS.map(([title, links], si) => (
        <div key={`${title}-${si}`}>
          <div className="side-section">{title}</div>
          {links.map(([href, label, icon]) => {
            const on = active(path, href, label);
            const b = badge(label);
            return (
              <Link key={`${label}-${href}`} href={href} className={`side-link${on ? " on" : ""}`}>
                <Icon name={icon} />
                <span style={{ flex: 1 }}>{label}</span>
                {b !== undefined && <span className="badge accent">{b}</span>}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="side-foot">
        <LogoutButton />
        <span className={`env${env === "Development" ? " env-dev" : ""}`}>
          <span className="env-dot" />
          {env}
        </span>
      </div>
    </aside>
  );
}

export function Topbar({ workspaceName, repoName, env, userLabel }: {
  workspaceName?: string; repoName?: string; env: string; userLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const initials = (userLabel ?? "C").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "C";
  return (
    <>
      <div className="topbar">
        <div className="top-chips">
          <div className="chip-select"><span><div className="k">Workspace</div><div className="v">{workspaceName ?? "Charie"}</div></span><span className="chev">▾</span></div>
          <div className="chip-select"><span><div className="k">Repository</div><div className="v">{repoName ?? "No repo connected"}</div></span><span className="chev">▾</span></div>
          <div className="chip-select"><span><div className="k">Environment</div><div className="v"><span className="env-dot" style={{ display: "inline-block", marginRight: 6 }} />{env}</div></span><span className="chev">▾</span></div>
          <button className="search-trigger" onClick={() => setOpen(true)} aria-label="Search and commands">
            <Icon name="search" size={14} />
            <span className="txt">Search or ask Charie…</span>
            <span className="spacer" />
            <span className="kbd">⌘K</span>
          </button>
        </div>
        <div className="topbar-right">
          <Link href="/guardian" className="icon-btn btn secondary" aria-label="Notifications" style={{ width: 36, height: 36, justifyContent: "center" }}><Icon name="bell" /></Link>
          <ThemeToggle />
          <span className="avatar-dot" title={userLabel ?? "You"}>{initials}</span>
        </div>
      </div>
      {open && <Palette close={() => setOpen(false)} />}
    </>
  );
}
