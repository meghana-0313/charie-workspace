// Theme toggle + pre-paint init. Stored in localStorage, dark by default.

"use client";

import { useEffect, useState } from "react";
import { signOutFirebase } from "@/lib/firebase-client";

/** Runs in <head> before paint so the theme never flashes. */
export const themeInitScript = `(function(){try{var t=null;try{t=localStorage.getItem("charie-theme");}catch(e){}if(!t){var m=document.cookie.match(/(?:^|; )charie-theme=([a-z]+)/);if(m)t=m[1];}if(!t&&matchMedia("(prefers-color-scheme: light)").matches)t="light";if(t==="light")document.documentElement.dataset.theme="light";try{localStorage.setItem("charie-theme",t||"dark");}catch(e){}document.cookie="charie-theme="+(t||"dark")+"; path=/; max-age=31536000; samesite=lax";}catch(e){}})();`;

function saveTheme(light: boolean) {
  try { localStorage.setItem("charie-theme", light ? "light" : "dark"); } catch { /* storage blocked */ }
  try { document.cookie = `charie-theme=${light ? "light" : "dark"}; path=/; max-age=31536000; samesite=lax`; } catch { /* cookies blocked */ }
}

export function ThemeToggle() {
  const [light, setLight] = useState(() => typeof document !== "undefined" && document.documentElement.dataset.theme === "light");
  useEffect(() => {
    const sync = () => setLight(document.documentElement.dataset.theme === "light");
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <button
      className="icon-btn"
      aria-pressed={light}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Dark theme" : "Light theme"}
      onClick={() => {
        const next = !light;
        setLight(next);
        if (next) {
          document.documentElement.dataset.theme = "light";
          saveTheme(true);
        } else {
          delete document.documentElement.dataset.theme;
          saveTheme(false);
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
        await signOutFirebase().catch(() => {});
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
