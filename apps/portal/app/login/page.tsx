// Standalone login: no sidebar, no app chrome. Email + password (with
// reset emails), one-click local owner in file-store mode.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CharieMark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme";
import { sendReset, signInWithEmail } from "@/lib/firebase-client";

interface Config {
  configured: boolean;
  devLogin: boolean;
  setupUrl: string;
}

type Busy = "local" | "email" | "reset" | "demo" | null;

export default function LoginPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  // Sign-in only: there is deliberately no sign-up on this page.
  // Workspaces are invite-only (the session route rejects uninvited
  // accounts), and judges should land in the demo, not create accounts.
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [userName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [cfgFailed, setCfgFailed] = useState(false);

  function loadCfg() {
    setCfgFailed(false);
    fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCfg(j as Config))
      .catch(() => {
        setCfgFailed(true);
        setError("Could not load sign-in options. Check your connection, then retry.");
      });
  }

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then((r) => {
        if (r.ok) router.push("/");
      })
      .catch(() => {});
    loadCfg();
  }, [router]);

  async function exchange(idToken: string): Promise<boolean> {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken, userName: userName.trim() || undefined }),
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
    } else if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
      setError("Wrong email or password.");
    } else if (code.includes("invalid-email")) {
      setError("That email address looks wrong.");
    } else if ((e as Error)?.message === "auth-not-configured") {
      setSetupNeeded(true);
    } else {
      setError(`Sign-in failed${code ? ` (${code})` : ""}. Try again.`);
    }
  }

  async function emailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy("email");
    setError("");
    setInfo("");
    try {
      const idToken = await signInWithEmail(email.trim(), password);
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

  async function demo() {
    if (busy) return;
    setBusy("demo");
    setError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ demo: true }),
    });
    if (res.ok) router.push("/");
    else setError("Demo Mode could not start. Try again.");
    setBusy(null);
  }

  return (
    <div className="login-wrap">
      <div className="login-shell">
        <div className="login-panel">
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <span className="side-mark"><CharieMark /></span>
            <div>
              <div className="login-name">CHARIE</div>
              <div className="small muted">Autonomous engineering intelligence</div>
            </div>
          </div>
          <p className="muted" style={{ margin: 0 }}>Your autonomous engineering team: QA, security, and production, in one workspace.</p>
          <div className="proof">
            <p className="small" style={{ margin: 0 }}><span className="check-dot done"><span aria-hidden="true">✓</span></span> Build: UX, accessibility and first-run checks with redesigns you can approve</p>
            <p className="small" style={{ margin: 0 }}><span className="check-dot done"><span aria-hidden="true">✓</span></span> Guard: threat hunting and a graded security suite, day and night</p>
            <p className="small" style={{ margin: 0 }}><span className="check-dot done"><span aria-hidden="true">✓</span></span> Ops + Meet: live signals, night shift, and video rooms where Charie joins the call</p>
            <p className="small" style={{ margin: 0 }}><span className="check-dot done"><span aria-hidden="true">✓</span></span> Nothing ships without your approval</p>
          </div>
        </div>
        <div className="login-card">
        <div style={{ display: "flex", justifyContent: "flex-end" }}><ThemeToggle /></div>
        <div className="login-brand">
          <div className="login-name" style={{ fontSize: 22 }}>{mode === "reset" ? "Reset your password" : "Welcome back"}</div>
          <p className="muted small" style={{ marginTop: 4 }}>{mode === "reset" ? "We will email you a reset link." : "Sign in to your workspace. New here? Explore the demo - workspaces are invite-only."}</p>
        </div>
        <div className="stack" style={{ marginTop: 14 }}>
          <button onClick={demo} disabled={busy !== null}>
            {busy === "demo" ? "Opening demo…" : "Explore Charie Demo - no login needed"}
          </button>
          <p className="small muted" style={{ margin: 0 }}>Sample workspace with three demo projects. No account needed; AI answers run on the host's configured Meta models.</p>
          {cfg?.devLogin && (
            <button onClick={local} disabled={busy !== null}>
              {busy === "local" ? "Signing in…" : "Continue as local owner (dev only)"}
            </button>
          )}
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
              <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required autoComplete="current-password" />
              <div className="row" style={{ marginTop: 10 }}>
                <button disabled={busy !== null}>{busy === "email" ? "Working…" : "Sign in"}</button>
              </div>
              <p className="small" style={{ marginTop: 8 }}>
                <button type="button" className="ghost sm" onClick={() => { setMode("reset"); setError(""); }}>Forgot password?</button>
              </p>
            </form>
          )}
          {cfgFailed && (
            <button type="button" className="ghost sm" onClick={loadCfg} disabled={busy !== null}>
              Retry loading sign-in
            </button>
          )}
          {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
          {info && <p className="small" style={{ color: "var(--accent-ink)" }}>{info}</p>}
          {setupNeeded && cfg && (
            <p className="small" style={{ color: "var(--warn)" }}>
              Sign-in is not enabled yet. <a href={cfg.setupUrl} target="_blank" rel="noreferrer">Enable Authentication</a>, then reload.
            </p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
