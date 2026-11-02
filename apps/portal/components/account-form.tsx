// Account settings: edit user name, change password (Firebase accounts).
"use client";

import { useState } from "react";
import { changePassword, sendReset } from "@/lib/firebase-client";

export function AccountForm({ initialName, email }: { initialName: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true); setMsg("");
    const res = await fetch("/api/account", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    }).catch(() => null);
    setBusy(false);
    setMsg(res?.ok ? "User name saved. It may take a reload to show everywhere." : "Could not save that name.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !current || next.length < 6) { setMsg("New password needs at least 6 characters."); return; }
    setBusy(true); setMsg("");
    try {
      await changePassword(email, current, next);
      setCurrent(""); setNext("");
      setMsg("Password changed.");
    } catch {
      setMsg("Password change failed. Check your current password, or use reset by email below.");
    }
    setBusy(false);
  }

  return (
    <div className="stack">
      <form onSubmit={saveName}>
        <label htmlFor="account-name">User name</label>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input id="account-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={{ flex: 1 }} />
          <button type="submit" className="sm" disabled={busy}>Save name</button>
        </div>
      </form>
      <form onSubmit={savePassword}>
        <label htmlFor="account-current">Change password</label>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input id="account-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" autoComplete="current-password" style={{ flex: 1 }} />
          <input aria-label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (6+ characters)" autoComplete="new-password" style={{ flex: 1 }} />
          <button type="submit" className="sm secondary" disabled={busy}>Change password</button>
        </div>
      </form>
      <p className="small" style={{ margin: 0 }}>
        <button type="button" className="ghost sm" disabled={busy || !email}
          onClick={async () => { setMsg(""); try { await sendReset(email); setMsg("Reset email sent."); } catch { setMsg("Reset email failed. Sign-in may not be configured for password accounts."); } }}>
          Email me a password reset link instead
        </button>
      </p>
      {msg && <p className="small" style={{ color: "var(--accent-ink)", margin: 0 }} role="status">{msg}</p>}
    </div>
  );
}
