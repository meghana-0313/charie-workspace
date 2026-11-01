// Standalone login: no sidebar, no app chrome. Google sign-in, email +
// password (with reset emails), one-click local owner in file-store mode.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CharieMark } from "@/components/mark";
import { completeGoogleRedirect, sendReset, signInWithEmail, signInWithGoogle, signInWithGoogleRedirect, signUpWithEmail } from "@/lib/firebase-client";

interface Config {
  configured: boolean;
  devLogin: boolean;
  setupUrl: string;
}

type Busy = "google" | "local" | "email" | "reset" | null;

export default function LoginPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    completeGoogleRedirect()
      .then((idToken) => {
        if (idToken) void exchange(idToken);
      })
      .catch(() => {});
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

  async function exchange(idToken: string): Promise<boolean> {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(j.error === "not invited" ? "This account is not invited yet. Ask your workspace owner for an invite." : `Sign in failed (${j.error ?? res.status}).`);
      return false;
    }
    router.push("/");
    return true;
  }

  function firebaseError(e: unknown): void {
    const code = String((e as { code?: string })?.code ?? "");
    if (code.includes("configuration-not-found") || code.includes("operation-not-allowed")) {
      setSetupNeeded(true);
    } else if (code.includes("popup-closed") || code.includes("cancelled")) {
      setError("Popup closed before sign-in finished. Try again.");
    } else if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
      setError("Wrong email or password.");
    } else if (code.includes("email-already-in-use")) {
      setError("This email already has an account. Sign in instead.");
    } else if (code.includes("weak-password")) {
      setError("Password needs at least 6 characters.");
    } else if (code.includes("invalid-email")) {
      setError("That email address looks wrong.");
    } else if ((e as Error)?.message === "auth-not-configured") {
      setSetupNeeded(true);
    } else if (code.includes("popup-blocked") || code.includes("popup-closed") || code.includes("cancelled-popup-request")) {
      setError(`Popup sign-in failed (${code || "blocked"}). Use the redirect button below instead.`);
    } else {
      setError(`Sign-in failed${code ? ` (${code})` : ""}. Try again or use redirect.`);
    }
  }

  async function googleRedirect() {
    if (busy) return;
    setBusy("google");
    setError("");
    setInfo("");
    try {
      await signInWithGoogleRedirect();
    } catch (e) {
      firebaseError(e);
      setBusy(null);
    }
  }

  async function google() {
    if (busy) return;
    setBusy("google");
    setError("");
    setInfo("");
    setSetupNeeded(false);
    try {
      await exchange(await signInWithGoogle());
    } catch (e) {
      firebaseError(e);
    }
    setBusy(null);
  }

  async function emailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy("email");
    setError("");
    setInfo("");
    try {
      const idToken = mode === "signup"
        ? await signUpWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password);
      await exchange(idToken);
    } catch (err) {
      firebaseError(err);
    }
    setBusy(null);
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy("reset");
    setError("");
    setInfo("");
    try {
      await sendReset(email.trim());
      setInfo("Reset email sent. Check your inbox (and spam), then sign in with the new password.");
      setMode("signin");
    } catch (err) {
      firebaseError(err);
    }
    setBusy(null);
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
          <button className="ghost sm" onClick={googleRedirect} disabled={busy !== null || cfg === null}>
            Popup blocked? Sign in with Google (redirect)
          </button>
          <div className="section-label">Or use email</div>
          {mode === "reset" ? (
            <form onSubmit={reset}>
              <label htmlFor="login-email">Email</label>
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
              <div className="row" style={{ marginTop: 10 }}>
                <button disabled={busy !== null}>{busy === "reset" ? "Sending…" : "Send reset email"}</button>
                <button type="button" className="ghost sm" onClick={() => { setMode("signin"); setError(""); }}>Back to sign in</button>
              </div>
            </form>
          ) : (
            <form onSubmit={emailAuth}>
              <label htmlFor="login-email">Email</label>
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "6+ characters" : "Your password"} required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              <div className="row" style={{ marginTop: 10 }}>
                <button disabled={busy !== null}>{busy === "email" ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}</button>
                <button type="button" className="ghost sm" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}>
                  {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
                </button>
              </div>
              {mode === "signin" && (
                <p className="small" style={{ marginTop: 8 }}>
                  <button type="button" className="ghost sm" onClick={() => { setMode("reset"); setError(""); }}>Forgot password?</button>
                </p>
              )}
            </form>
          )}
          {cfg?.devLogin && (
            <button className="secondary" onClick={local} disabled={busy !== null}>
              {busy === "local" ? "Signing in…" : "Continue as local owner (dev only)"}
            </button>
          )}
          {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
          {info && <p className="small" style={{ color: "var(--accent-ink)" }}>{info}</p>}
          {setupNeeded && cfg && (
            <p className="small" style={{ color: "var(--warn)" }}>
              Sign-in is not switched on for this project yet. One step: open{" "}
              <a href={cfg.setupUrl} target="_blank" rel="noreferrer">Authentication</a>,
              press Get started, enable a provider, then reload this page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
