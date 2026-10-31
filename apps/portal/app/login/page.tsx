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
    <div className="panel" style={{ maxWidth: 420, margin: "60px auto" }}>
      <h2>GhostQA login</h2>
      <p className="muted small">Enter the shared dashboard passphrase.</p>
      <form onSubmit={submit} className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="passphrase"
          autoFocus
        />
        <button type="submit">Sign in</button>
        {error && <p className="small" style={{ color: "var(--danger, #c00)" }}>{error}</p>}
      </form>
    </div>
  );
}
