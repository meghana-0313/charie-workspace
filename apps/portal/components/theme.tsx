// Theme toggle + pre-paint init. Stored in localStorage, dark by default.

"use client";

import { useEffect, useState } from "react";
import { signOutGoogle } from "@/lib/firebase-client";

/** Runs in <head> before paint so the theme never flashes. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("charie-theme");if(!t&&matchMedia("(prefers-color-scheme: light)").matches)t="light";if(t==="light")document.documentElement.dataset.theme="light";}catch(e){}})();`;

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(document.documentElement.dataset.theme === "light");
  }, []);
  return (
    <button
      className="icon-btn"
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Dark theme" : "Light theme"}
      onClick={() => {
        const next = !light;
        setLight(next);
        if (next) {
          document.documentElement.dataset.theme = "light";
          localStorage.setItem("charie-theme", "light");
        } else {
          delete document.documentElement.dataset.theme;
          localStorage.setItem("charie-theme", "dark");
        }
      }}
    >
      {light ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
        </svg>
      )}
    </button>
  );
}

export function LogoutButton() {
  return (
    <button
      className="side-link as-button"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" }).catch(() => {});
        await signOutGoogle().catch(() => {});
        location.href = "/login";
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4H6v16h8M10 12h11M18 8l4 4-4 4" />
      </svg>
      Log out
    </button>
  );
}
