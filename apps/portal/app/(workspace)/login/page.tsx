"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CharieMark } from "@/components/mark";

export default function LoginPage() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passphrase, name: name.trim() || undefined }),
    });
    if (res.ok) router.push("/");
    else setError("Wrong passphrase - try again.");
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="row" style={{ marginBottom: 4 }}>
          <span className="side-mark"><CharieMark /></span>
          <strong style={{ fontSize: "var(--text-lg)" }}>CHARIE</strong>
        </div>
        <p className="muted small">Autonomous engineering intelligence. Owners sign in with the shared passphrase; teammates add their seat name.</p>
        <form onSubmit={submit} className="stack" style={{ marginTop: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="seat name (blank for owner)"
            autoComplete="username"
            aria-label="seat name"
          />
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
