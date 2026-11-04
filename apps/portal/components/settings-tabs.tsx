// Settings sections as real tabs: one section at a time, no page scroll.
// The server page renders every section card; this shell shows only the
// active one and remembers it in the URL hash (e.g. /settings#account).
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";

const TABS = [
  ["general", "gear", "General"],
  ["appearance", "eye", "Appearance"],
  ["connections", "plug", "Connections"],
  ["autopilot", "bolt", "Autopilot"],
  ["system", "signal", "System status"],
  ["account", "users", "Account"],
] as const;

export function SettingsTabs({ children }: { children: ReactNode[] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const i = TABS.findIndex(([id]) => `#${id}` === window.location.hash);
    if (i >= 0) setActive(i);
  }, []);
  const pick = (i: number) => {
    setActive(i);
    try { window.history.replaceState(null, "", `#${TABS[i][0]}`); } catch { /* noop */ }
  };
  return (
    <div className="settings-layout">
      <nav className="setnav" aria-label="Settings sections">
        {TABS.map(([id, icon, label], i) => (
          <button
            key={id}
            type="button"
            className={i === active ? "on" : ""}
            aria-current={i === active ? "page" : undefined}
            onClick={() => pick(i)}
          >
            <Icon name={icon} /> {label}
          </button>
        ))}
      </nav>
      <div>{children[active]}</div>
    </div>
  );
}
