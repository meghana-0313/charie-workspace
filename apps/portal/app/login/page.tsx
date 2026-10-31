"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    if (res.ok) router.push("/");
    else setError("Wrong passphrase - try again.");
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="row" style={{ marginBottom: 4 }}>
          <span className="side-mark">C</span>
          <strong style={{ fontSize: "var(--text-lg)" }}>Agent CB</strong>
        </div>
        <p className="muted small">Build + Runtime Intelligence. Enter the shared dashboard passphrase.</p>
        <form onSubmit={submit} className="stack" style={{ marginTop: 12 }}>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="passphrase"
            autoFocus
            aria-label="passphrase"
          />
          <button type="submit">Sign in</button>
          {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
        </form>
      </div>
    </div>
  );
}
