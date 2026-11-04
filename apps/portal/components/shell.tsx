// Application shell: grouped sidebar (reference IA) + context topbar.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { CharieMark } from "./mark";
import { Palette } from "./palette";
import { LogoutButton, ThemeToggle } from "./theme";
import { useEffect, useState } from "react";

type NavLink = [string, string, string, number?];

const SECTIONS: Array<[string, NavLink[]]> = [
  ["START HERE", [
    ["/", "Overview", "home"],
    ["/tickets", "Tickets & Fixes", "ticket"],
    ["/reports", "Reports", "order"],
    ["/chat", "Chat with Charie", "chat"],
    ["/guardian/zoom", "Meet", "video"],
  ]],
  ["CHARIE BUILD", [
    ["/ux", "UX & Redesign", "eye"],
    ["/a11y", "Accessibility", "access"],
    ["/firstrun", "First Run", "play"],
    ["/repos", "Repositories", "layers"],
  ]],
  ["CHARIE OPS", [
    ["/guardian/night", "Night Shift", "moon"],
    ["/guardian/signals", "Live Signals", "signal"],
    ["/autopilot", "Autopilot", "bolt"],
    ["/agents", "Coding Agents", "code"],
  ]],
  ["CHARIE GUARD", [
    ["/guardian", "Threats", "alert"],
    ["/guardian/security", "Security Tests", "lock"],
    ["/guardian/work", "Fix Tasks", "order"],
  ]],
  ["INTEGRATIONS", [
    ["/marketplace", "Integrations", "plug"],
  ]],
  ["ACCOUNT", [
    ["/team", "Team", "users"],
    ["/settings", "Settings", "gear"],
  ]],
];

function active(path: string, href: string, label: string): boolean {
  if (href === "/") return path === "/";
  if (label === "Threats") return path === "/guardian" || /^\/guardian\/[^/]+$/.test(path) && !path.startsWith("/guardian/work") && !path.startsWith("/guardian/security") && !path.startsWith("/guardian/signals") && !path.startsWith("/guardian/night") && !path.startsWith("/guardian/zoom");
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({ env, workspaceName, ticketsOpen, incidentsOpen }: {
  env: string; workspaceName?: string; ticketsOpen?: number; incidentsOpen?: number;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem("charie-nav-collapsed") === "1");
  }, []);
  useEffect(() => {
    document.querySelector(".shell")?.classList.toggle("nav-collapsed", collapsed);
    try { localStorage.setItem("charie-nav-collapsed", collapsed ? "1" : "0"); } catch { /* private mode */ }
  }, [collapsed]);
  const badge = (label: string) => label === "Tickets & Fixes" && ticketsOpen ? ticketsOpen : label === "Threats" && incidentsOpen ? incidentsOpen : undefined;
  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="row brand-row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <Link href="/" className="side-brand">
          <span className="side-mark"><CharieMark /></span>
          <span>
            <span className="side-name">{workspaceName ?? "CHARIE"}</span>
            
          </span>
        </Link>
        <button type="button" className="icon-btn nav-toggle" aria-expanded={!collapsed} aria-controls="charie-sidebar-nav" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((c) => !c)}>
          <Icon name={collapsed ? "chev-r" : "chev-l"} />
        </button>
      </div>
      <nav id="charie-sidebar-nav" aria-label="Primary">{SECTIONS.map(([title, links], si) => (
        <div key={`${title}-${si}`}>
          <div className="side-section">{title}</div>
          {links.map(([href, label, icon]) => {
            const on = active(path, href, label);
            const b = badge(label);
            return (
              <Link key={`${label}-${href}`} href={href} title={label} aria-label={label} aria-current={on ? "page" : undefined} className={`side-link${on ? " on" : ""}`}>
                <Icon name={icon} />
                <span className="side-label" style={{ flex: 1 }}>{label}</span>
                {b !== undefined && <span className="badge accent">{b}</span>}
              </Link>
            );
          })}
        </div>
      ))}</nav>
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

export function Topbar({ workspaceName, repoName, repos = [], env, userLabel, alerts = [] }: {
  workspaceName?: string;
  repoName?: string;
  repos?: Array<{ id: string; name: string }>;
  env: string;
  userLabel?: string;
  alerts?: Array<{ href: string; label: string; sub: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  // The search trigger advertises Cmd/Ctrl-K: make the shortcut real.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const initials = (userLabel ?? "C").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "C";
  const toggle = (m: string) => setMenu((cur) => (cur === m ? null : m));
  const close = () => setMenu(null);
  return (
    <>
      <div className="topbar">
        <div className="top-chips">
          <div className="menu-wrap">
            <button type="button" className="chip-select" aria-haspopup="menu" aria-expanded={menu === "ws"} onClick={() => toggle("ws")}>
              <span><div className="k">Workspace</div><div className="v">{workspaceName ?? "Charie"}</div></span><span className="chev">▾</span>
            </button>
            {menu === "ws" && (
              <div className="menu" role="menu">
                <div className="menu-head"><strong className="small">{workspaceName ?? "Charie"}</strong></div>
                <Link className="menu-item" href="/settings" onClick={close}><Icon name="gear" /> Workspace settings</Link>
              </div>
            )}
          </div>
          <div className="menu-wrap">
            <button type="button" className="chip-select" aria-haspopup="menu" aria-expanded={menu === "repo"} onClick={() => toggle("repo")}>
              <span><div className="k">Repository</div><div className="v">{repoName ?? "No repo connected"}</div></span><span className="chev">▾</span>
            </button>
            {menu === "repo" && (
              <div className="menu" role="menu">
                <div className="menu-head"><strong className="small">Repositories</strong><br /><span className="sub small muted">{repos.length} connected</span></div>
                {repos.length === 0 && <div className="menu-item"><span className="muted small">None yet. Connect one to build and test here.</span></div>}
                {repos.slice(0, 6).map((r) => (
                  <Link key={r.id} className="menu-item" href={`/repos/${r.id}`} onClick={close}><Icon name="repo" /> {r.name}</Link>
                ))}
                <Link className="menu-item" href="/repos" onClick={close}><Icon name="plus" /> Connect a repository</Link>
              </div>
            )}
          </div>
          <div className="menu-wrap">
            <button type="button" className="chip-select" aria-haspopup="menu" aria-expanded={menu === "env"} onClick={() => toggle("env")}>
              <span><div className="k">Environment</div><div className="v"><span className="env-dot" style={{ display: "inline-block", marginRight: 6 }} />{env}</div></span><span className="chev">▾</span>
            </button>
            {menu === "env" && (
              <div className="menu" role="menu">
                <div className="menu-head"><strong className="small">{env}</strong><br /><span className="sub small muted">{env === "Production" ? "Hosted data: Firestore + Cloud Storage" : "Local data: JSON files on this machine"}</span></div>
                <Link className="menu-item" href="/settings" onClick={close}><Icon name="signal" /> System status</Link>
                <Link className="menu-item" href="/autopilot" onClick={close}><Icon name="bolt" /> Autopilot and schedules</Link>
              </div>
            )}
          </div>
          <button className="search-trigger" onClick={() => setOpen(true)} aria-label="Search and commands">
            <Icon name="search" size={14} />
            <span className="txt">Search or ask Charie…</span>
            <span className="spacer" />
            <span className="kbd">⌘K</span>
          </button>
        </div>
        <div className="topbar-right">
          <div className="menu-wrap">
            <span className="bell-wrap">
              <button type="button" className="icon-btn btn secondary" aria-label="Notifications" aria-haspopup="menu" aria-expanded={menu === "bell"} onClick={() => toggle("bell")} style={{ width: 36, height: 36, justifyContent: "center" }}><Icon name="bell" /></button>
              {alerts.length > 0 && <span className="bell-dot">{alerts.length}</span>}
            </span>
            {menu === "bell" && (
              <div className="menu right" role="menu">
                <div className="menu-head"><strong className="small">Needs attention</strong><br /><span className="sub small muted">{alerts.length} open item(s)</span></div>
                {alerts.length === 0 && <div className="menu-item"><span className="muted small">All clear. No open incidents or tickets.</span></div>}
                {alerts.slice(0, 6).map((a, i) => (
                  <Link key={i} className="menu-item" href={a.href} onClick={close}><span style={{ flex: 1 }}><span>{a.label}</span><br /><span className="sub">{a.sub}</span></span><Icon name="arrow" /></Link>
                ))}
              </div>
            )}
          </div>
          <ThemeToggle />
          <div className="menu-wrap">
            <button type="button" className="avatar-dot" title={userLabel ?? "You"} aria-haspopup="menu" aria-expanded={menu === "me"} onClick={() => toggle("me")}>{initials}</button>
            {menu === "me" && (
              <div className="menu right" role="menu">
                <div className="menu-head"><strong className="small">{userLabel ?? "You"}</strong><br /><span className="sub small muted">Signed in</span></div>
                <Link className="menu-item" href="/settings" onClick={close}><Icon name="gear" /> Settings</Link>
                <LogoutButton />
              </div>
            )}
          </div>
        </div>
      </div>
      {menu && <div className="menu-backdrop" role="presentation" onClick={close} />}
      {open && <Palette close={() => setOpen(false)} />}
    </>
  );
}
