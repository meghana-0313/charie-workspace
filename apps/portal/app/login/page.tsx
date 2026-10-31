// Standalone login: no sidebar, no app chrome. Google sign-in via Firebase,
// one-click local owner in file-store mode, honest setup guidance otherwise.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CharieMark } from "@/components/mark";
import { signInWithGoogle } from "@/lib/firebase-client";

interface Config {
  configured: boolean;
  devLogin: boolean;
  setupUrl: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [busy, setBusy] = useState<"google" | "local" | null>(null);
  const [error, setError] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((r) => {
        if (r.ok) router.push("/");
      })
      .catch(() => {});
    fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCfg(j as Config))
      .catch(() => setError("Could not reach the portal. Is it running?"));
  }, [router]);

  async function google() {
    if (busy) return;
    setBusy("google");
    setError("");
    setSetupNeeded(false);
    try {
      const idToken = await signInWithGoogle();
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error === "not invited" ? "This Google account is not invited yet. Ask your workspace owner for an invite." : `Sign in failed (${j.error ?? res.status}).`);
        setBusy(null);
        return;
      }
      router.push("/");
    } catch (e) {
      const code = String((e as { code?: string })?.code ?? "");
      if (code.includes("configuration-not-found") || code.includes("operation-not-allowed")) {
        setSetupNeeded(true);
      } else if (code.includes("popup-closed") || code.includes("cancelled")) {
        setError("Popup closed before sign-in finished. Try again.");
      } else if ((e as Error)?.message === "auth-not-configured") {
        setSetupNeeded(true);
      } else {
        setError("Google sign-in failed. Try again.");
      }
      setBusy(null);
    }
  }

  async function local() {
    if (busy) return;
    setBusy("local");
    setError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ localOwner: true }),
    });
    if (res.ok) router.push("/");
    else setError("Local sign-in is disabled on this host.");
    setBusy(null);
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="row" style={{ marginBottom: 4 }}>
          <span className="side-mark"><CharieMark /></span>
          <strong style={{ fontSize: "var(--text-lg)" }}>CHARIE</strong>
        </div>
        <p className="muted small">Autonomous engineering intelligence. Sign in to reach your workspace.</p>
        <div className="stack" style={{ marginTop: 14 }}>
          <button onClick={google} disabled={busy !== null || cfg === null}>
            {busy === "google" ? "Waiting for Google…" : "Sign in with Google"}
          </button>
          {cfg?.devLogin && (
            <button className="secondary" onClick={local} disabled={busy !== null}>
              {busy === "local" ? "Signing in…" : "Continue as local owner (dev only)"}
            </button>
          )}
          {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
          {setupNeeded && cfg && (
            <p className="small" style={{ color: "var(--warn)" }}>
              Google sign-in is not switched on for this project yet. One step: open{" "}
              <a href={cfg.setupUrl} target="_blank" rel="noreferrer">Authentication</a>,
              press Get started, enable the Google provider, then reload this page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
