// Marketplace client components: Jira connect, sync rules, context docs.

"use client";

import { useState } from "react";
import { Badge } from "./ui";

export function JiraConnectForm() {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/connectors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "jira", domain: domain.trim(), email: email.trim(), token: token.trim() }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "connect failed");
      return;
    }
    location.reload();
  }
  return (
    <form onSubmit={run}>
      <label htmlFor="jira-domain">Jira domain</label>
      <input id="jira-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.atlassian.net" required />
      <label htmlFor="jira-email">Jira email</label>
      <input id="jira-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
      <label htmlFor="jira-token">API token (<a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">create one</a>)</label>
      <input id="jira-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="stored server-side, never shown" required autoComplete="off" />
      <div className="row" style={{ marginTop: 10 }}>
        <button disabled={busy}>{busy ? "Connecting…" : "Connect Jira"}</button>
        {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
    </form>
  );
}

export function ConnectorActions({ id, kind }: { id: string; kind: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function test() {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/connectors/${id}/test`, { method: "POST" });
    const j = (await res.json().catch(() => ({}))) as { detail?: string };
    setMsg(j.detail ?? (res.ok ? "ok" : "failed"));
    setBusy(false);
    if (res.ok) setTimeout(() => location.reload(), 800);
  }
  async function remove() {
    if (!confirm("Disconnect? Sync rules on this connector stop too.")) return;
    setBusy(true);
    await fetch(`/api/connectors/${id}`, { method: "DELETE" });
    location.reload();
  }
  return (
    <span className="row">
      {kind === "jira" && <button type="button" className="secondary sm" disabled={busy} onClick={test}>Test</button>}
      <button type="button" className="danger-ghost sm" disabled={busy} onClick={remove}>Disconnect</button>
      {msg && <span className="small muted">{msg}</span>}
    </span>
  );
}

export function RuleForm({ connectors }: { connectors: Array<{ id: string; name: string }> }) {
  const [connectorId, setConnectorId] = useState(connectors[0]?.id ?? "");
  const [project, setProject] = useState("");
  const [jql, setJql] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [preset, setPreset] = useState("daily");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !connectorId) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/sync-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectorId, project, jql, targetUrl, preset }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "rule failed");
      return;
    }
    location.reload();
  }
  if (connectors.length === 0) return <p className="small muted">Connect Jira first with the <a href="#connect-jira">Jira form above</a>, then add a pull rule here.</p>;
  return (
    <form onSubmit={run}>
      <div className="row">
        <select value={connectorId} onChange={(e) => setConnectorId(e.target.value)} aria-label="Connector">
          {connectors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project KEY (blank = all)" aria-label="Project key" style={{ maxWidth: 160 }} />
        <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="How often">
          <option value="hourly">Pull every hour</option>
          <option value="daily">Pull daily</option>
          <option value="weekly">Pull weekly</option>
        </select>
      </div>
      <label htmlFor="rule-jql">JQL (optional, overrides project)</label>
      <input id="rule-jql" value={jql} onChange={(e) => setJql(e.target.value)} placeholder="project = SHOP AND status = To Do ORDER BY created DESC" />
      <p className="small muted">
        JQL picks which issues to pull. Examples:{" "}
        <button type="button" className="ghost sm" onClick={() => setJql("project = SHOP AND status = To Do ORDER BY created DESC")}>open issues in a project</button>{" "}
        <button type="button" className="ghost sm" onClick={() => setJql("labels = customer-reported AND created >= -7d ORDER BY created DESC")}>recent customer reports</button>
      </p>
      <label htmlFor="rule-target">App URL to test pulled issues against</label>
      <input id="rule-target" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://your-app.example.com" required />
      <div className="row" style={{ marginTop: 10 }}>
        <button disabled={busy}>{busy ? "Saving…" : "Add pull rule"}</button>
        {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
    </form>
  );
}

export function RuleRow({ id, label, preset, enabled, lastStatus }: { id: string; label: string; preset: string; enabled: boolean; lastStatus?: string }) {
  const [busy, setBusy] = useState(false);
  async function act(path: string, init?: RequestInit) {
    setBusy(true);
    await fetch(path, init);
    location.reload();
  }
  return (
    <tr>
      <td className="small">{label}</td>
      <td><Badge>{preset}</Badge></td>
      <td className="small muted">{lastStatus ?? "never"}</td>
      <td>
        <span className="row">
          <button type="button" className="secondary sm" disabled={busy || !enabled} onClick={() => act(`/api/sync-rules/${id}/run`, { method: "POST" })}>Pull now</button>
          <button
            type="button" className="secondary sm" disabled={busy}
            onClick={() => act(`/api/sync-rules/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) })}
          >
            {enabled ? "Pause" : "Resume"}
          </button>
          <button type="button" className="danger-ghost sm" disabled={busy} onClick={() => { if (confirm("Delete this rule?")) void act(`/api/sync-rules/${id}`, { method: "DELETE" }); }}>Delete</button>
        </span>
      </td>
    </tr>
  );
}

export function ContextForm() {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("note");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/context-docs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, source, body, url }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "save failed");
      return;
    }
    location.reload();
  }
  return (
    <form onSubmit={run}>
      <div className="row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Checkout notes" aria-label="Title" style={{ flex: 1 }} />
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="note">note</option>
          <option value="url">url</option>
        </select>
      </div>
      {source === "note" ? (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Anything Charie should know when chatting and investigating…" style={{ marginTop: 8 }} />
      ) : (
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs… (passed to chat as a reference)" style={{ marginTop: 8 }} />
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button disabled={busy}>{busy ? "Saving…" : "Add context"}</button>
        {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
    </form>
  );
}

export function ContextRow({ id, title, source, preview }: { id: string; title: string; source: string; preview: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <tr>
      <td>{title}</td>
      <td><Badge>{source}</Badge></td>
      <td className="small muted">{preview}</td>
      <td>
        <button
          type="button" className="danger-ghost sm" disabled={busy}
          onClick={async () => {
            if (!confirm(`Delete "${title}"?`)) return;
            setBusy(true);
            await fetch(`/api/context-docs/${id}`, { method: "DELETE" });
            location.reload();
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
