// Team seat management forms (admin only, enforced server side too).

"use client";

import { useState } from "react";
import { Badge } from "./ui";

export function SeatForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError("");
    setCreated("");
    const res = await fetch("/api/team/seats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
    setBusy(false);
    if (!res.ok || !j.email) {
      setError(j.error ?? "invite failed");
      return;
    }
    setCreated(j.email);
    setEmail("");
    setTimeout(() => location.reload(), 3000);
  }
  return (
    <div>
      <form onSubmit={run}>
        <div className="row">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" aria-label="Teammate email" style={{ flex: 1, minWidth: 160 }} />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <button type="submit" disabled={busy}>{busy ? "Inviting…" : "Invite"}</button>
        </div>
      </form>
      {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      {created && (
        <p className="small" style={{ marginTop: 8 }}>
          Invited <strong>{created}</strong>. They sign in with Google and link automatically.
        </p>
      )}
    </div>
  );
}

export function ApiKeyForm() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState("");
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    setSecret("");
    const res = await fetch("/api/team/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; secret?: string };
    setBusy(false);
    if (!res.ok || !j.secret) {
      setError(j.error ?? "key creation failed");
      return;
    }
    setSecret(j.secret);
    setName("");
    setTimeout(() => location.reload(), 12000);
  }
  return (
    <div>
      <form onSubmit={run}>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="App name, e.g. shop-ios" aria-label="App name" style={{ flex: 1, minWidth: 160 }} />
          <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create key"}</button>
        </div>
      </form>
      {error && <p className="small" style={{ color: "var(--danger)" }}>{error}</p>}
      {secret && (
        <p className="small" style={{ marginTop: 8 }}>
          Key created. Copy it now (never shown again): <code>{secret}</code>
        </p>
      )}
    </div>
  );
}

export function ApiKeyRow({ id, prefix, name, createdAt, lastUsedAt, revoked }: { id: string; prefix: string; name: string; createdAt: string; lastUsedAt?: string; revoked: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <tr>
      <td><code>chp_{prefix}_…</code></td>
      <td>{name}</td>
      <td className="small muted">{lastUsedAt ? `used ${lastUsedAt.slice(0, 16).replace("T", " ")}` : `created ${createdAt.slice(0, 16).replace("T", " ")}`}</td>
      <td>
        {revoked ? <Badge>revoked</Badge> : (
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              if (!confirm(`Revoke the key for ${name}? Its app stops reporting.`)) return;
              setBusy(true);
              await fetch(`/api/team/keys/${id}`, { method: "DELETE" });
              location.reload();
            }}
          >
            Revoke
          </button>
        )}
      </td>
    </tr>
  );
}

export function SeatRow({ id, email, name, role, owner, linked, lastLoginAt }: { id: string; email: string; name?: string; role: string; owner?: boolean; linked: boolean; lastLoginAt?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <tr>
      <td>{email}{name ? <><br /><span className="small muted">{name}</span></> : null}</td>
      <td><Badge>{owner ? "owner" : role}</Badge></td>
      <td className="small muted">{linked ? "linked" : "invited"}</td>
      <td className="small muted">{lastLoginAt ? lastLoginAt.slice(0, 16).replace("T", " ") : "never"}</td>
      <td>
        {!owner && (
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              if (!confirm(`Remove ${email}'s seat?`)) return;
              setBusy(true);
              await fetch(`/api/team/seats/${id}`, { method: "DELETE" });
              location.reload();
            }}
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}
