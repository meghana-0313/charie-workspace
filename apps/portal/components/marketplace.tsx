// Marketplace client components: Jira connect, sync rules, context docs.

"use client";

import { useState } from "react";
import { Badge } from "./ui";

/** Brand marks as simple geometric SVGs in brand colors (tiles per reference). */
export function AppLogo({ app }: { app: string }) {
  const s = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true } as const;
  switch (app) {
    case "github":
      return <svg {...s}><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34a2.65 2.65 0 0 0-1.11-1.46c-.91-.62.07-.61.07-.61a2.1 2.1 0 0 1 1.53 1 2.12 2.12 0 0 0 2.9.83 2.13 2.13 0 0 1 .63-1.33c-2.22-.25-4.56-1.11-4.56-4.94a3.87 3.87 0 0 1 1-2.67 3.6 3.6 0 0 1 .1-2.64s.84-.27 2.75 1a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1 2.75-1a3.6 3.6 0 0 1 .1 2.64 3.87 3.87 0 0 1 1 2.67c0 3.84-2.34 4.68-4.57 4.93a2.4 2.4 0 0 1 .68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2z" /></svg>;
    case "gitlab":
      return <svg {...s}><path d="M12 21.5L8.2 9.9h7.6zM5.6 21L3.1 13.2a1.5 1.5 0 0 1 .6-1.7L8.2 9.9zm12.8 0l2.5-7.8a1.5 1.5 0 0 0-.6-1.7l-4.5-1.6zm-10-11.6L6.6 4.6a.55.55 0 0 0-1 0L4.2 9.3a1.5 1.5 0 0 0 .6 1.7zm9.2 0l1.8-5.3a.55.55 0 0 1 1 0l1.4 4.7a1.5 1.5 0 0 1-.6 1.7z" /></svg>;
    case "jira":
      return <svg {...s}><path d="M11.5 3h9v9h-4.7V7.7H11.5zm-6.2 6.3h9v9H9.6V14H5.3zm-3.2 6.2h9v9H6.4v-4.3H2.1z" transform="scale(0.92)" /></svg>;
    case "slack":
      return <svg {...s}><path d="M9.4 3.5a1.8 1.8 0 0 0-1.8 1.8v3.6a1.8 1.8 0 1 0 3.6 0V5.3a1.8 1.8 0 0 0-1.8-1.8zm9.3 5.4h-3.6a1.8 1.8 0 1 0 0 3.6h3.6a1.8 1.8 0 1 0 0-3.6zM5.3 13.1a1.8 1.8 0 1 0 0 3.6h3.6a1.8 1.8 0 1 0 0-3.6zm9.3 1.8v3.6a1.8 1.8 0 1 0 3.6 0v-3.6a1.8 1.8 0 1 0-3.6 0z" /></svg>;
    case "sentry":
      return <svg {...s}><path d="M12 3a7 7 0 0 1 7 7c0 2.4-1.2 4.2-2.6 5.6L21 21h-3.4l-3.2-3.6A7 7 0 0 1 5 10a7 7 0 0 1 7-7zm-2.2 6.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm4.4 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z" /></svg>;
    case "datadog":
      return <svg {...s}><circle cx="8" cy="8" r="2.2" /><circle cx="15" cy="6.5" r="2" /><circle cx="18.5" cy="11" r="2" /><path d="M12 12.5c3 0 5.5 2.1 5.5 4.6 0 1.6-1.2 2.6-3 2.6-1 0-1.7-.4-2.5-.4s-1.5.4-2.5.4c-1.8 0-3-1-3-2.6 0-2.5 2.5-4.6 5.5-4.6z" /></svg>;
    case "aws":
      return <svg {...s}><path d="M4 8.5c0 4 3.2 6.5 6.6 6.5 1.7 0 3.6-.7 5-1.7l2.3 2a.5.5 0 0 1-.2.8c-1.9 1.4-4.5 2-6.8 2C6 18.1 2.8 14.7 2.5 10.6A8.6 8.6 0 0 1 4 8.5zm14.9 6.2c-.4-.5-1.7-.2-2.4-.1-.2 0-.2-.2 0-.4 1.3-.9 3.4-.6 3.6-.3.2.3-.1 2.3-1.2 3.3-.2.2-.4.1-.3-.1.3-.6 1-1.9.9-2.4zM9 5.2a3.4 3.4 0 0 1 6.8.3v.3c0 .3.1.4.4.7l1.2 1.7a.5.5 0 0 1-.3.8l-1.7.7a.5.5 0 0 1-.6-.3L13.4 7c-.9.7-2.2 1-3.4.9A3.2 3.2 0 0 1 9 5.2z" transform="scale(0.95)" /></svg>;
    case "gcp":
      return <svg {...s}><path d="M7 18a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.3 10 3.8 3.8 0 0 1 17.5 18z" /></svg>;
    case "firebase":
      return <svg {...s}><path d="M12 2s1 3.2-1.6 6C8.2 10.3 6.5 12 6.5 15a5.5 5.5 0 0 0 11 0c0-2-1-3.6-2-5-.3 1-1 1.8-2 2.3.6-2.8-.3-7.3-1.5-10.3z" /></svg>;
    case "linear":
      return <svg {...s}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5.5 15.5a9 9 0 0 1 13-7M4 12h16M8 5.8a9 9 0 0 1 10.2 10.4" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>;
    case "discord":
      return <svg {...s}><path d="M6.5 5.5A13 13 0 0 1 9.6 4.6l.5 1a10.7 10.7 0 0 0-5 4.6A13.4 13.4 0 0 1 6.6 9.9c.1.2.2.5.3.7a10.8 10.8 0 0 0 3.3 5.7c.2.2.6.1.6-.4a7.7 7.7 0 0 1-.8-1.2c-.1-.2 0-.4.2-.5l.6-.3c.2-.1.4 0 .6.1a8.7 8.7 0 0 0 6.8 0c.2-.1.4-.2.6-.1l.6.3c.2.1.3.3.2.5l-.8 1.3c-.1.4.4.5.6.3a10.8 10.8 0 0 0 3.3-5.7c.1-.2.2-.5.3-.7-.5-.2-1-.4-1.5-.7a10.7 10.7 0 0 0-5-4.6l.5-1c1 .2 2.1.5 3.1.9a2 2 0 0 1 1.2 1.4l1.2 7a2.3 2.3 0 0 1-1 2.4 14.7 14.7 0 0 1-3.4 1.7c-.3.1-.6 0-.7-.3l-.6-1.2a10.6 10.6 0 0 1-3 0l-.6 1.2c-.1.3-.4.4-.7.3a14.7 14.7 0 0 1-3.4-1.7 2.3 2.3 0 0 1-1-2.4l1.2-7A2 2 0 0 1 6.5 5.5zM9.7 15.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zm4.6 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z" transform="scale(0.92) translate(1 0)" /></svg>;
    default:
      return <svg {...s}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.5-1.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
  }
}

const APP_COLORS: Record<string, [string, string]> = {
  github: ["#24292f", "#fff"], gitlab: ["#fc6d26", "#fff"], jira: ["#2684ff", "#fff"],
  slack: ["#611f69", "#fff"], sentry: ["#362d59", "#fff"], datadog: ["#632ca6", "#fff"],
  aws: ["#ff9900", "#232f3e"], gcp: ["#4285f4", "#fff"], firebase: ["#ffca28", "#5f4300"],
  linear: ["#5e6ad2", "#fff"], discord: ["#5865f2", "#fff"], webhook: ["#202949", "#c9b3ff"],
};

export function AppTiles({ githubConnected, jiraConnected }: { githubConnected: boolean; jiraConnected: boolean }) {
  const apps: Array<[string, string, string, string, string]> = [
    ["github", "GitHub", "Repos, PRs, issues and actions", githubConnected ? "connected" : "connect", "/repos"],
    ["jira", "Jira", "Sync issues, epics and sprints", jiraConnected ? "connected" : "connect", "#connect-jira"],
    ["webhook", "Webhooks", "Prod apps report errors with ingest keys", "active", "/team"],
    ["gcp", "Google Cloud", "Logs, builds and hosting via GCP", "via gcp", "/settings"],
    ["firebase", "Firebase", "Build, run and monitor apps", "via gcp", "/settings"],
    ["slack", "Slack", "Alerts, updates and approvals", "soon", "#"],
    ["gitlab", "GitLab", "Manage code, MRs and pipelines", "soon", "#"],
    ["sentry", "Sentry", "Errors, crashes and performance", "soon", "#"],
    ["datadog", "Datadog", "Logs, metrics and traces", "soon", "#"],
    ["aws", "AWS", "Infrastructure and deployments", "soon", "#"],
    ["linear", "Linear", "Issues and project tracking", "soon", "#"],
    ["discord", "Discord", "Community alerts and updates", "soon", "#"],
  ];
  return (
    <>
      <div className="tabs">
        <span className="tab on" style={{ padding: "7px 14px" }}>All (12)</span>
        <span className="small muted" style={{ alignSelf: "center" }}>Dev & Code (4) · CI/CD (3) · Monitoring (3)</span>
        <span className="spacer" />
        <span className="small muted" style={{ alignSelf: "center" }}>Only live connectors run actions; the rest are on the roadmap.</span>
      </div>
      <div className="app-tiles" style={{ marginBottom: "var(--space-4)" }}>
        {apps.map(([app, name, desc, state, href]) => {
          const [bg, fg] = APP_COLORS[app] ?? ["#202949", "#fff"];
          return (
            <div key={app} className="app-tile">
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <span className="app-logo" style={{ background: bg, color: fg }}><AppLogo app={app} /></span>
                <strong>{name}</strong>
                <span className="spacer" />
                {state === "connected" || state === "active" ? <span className="badge minor">Connected</span>
                  : state === "soon" ? <span className="badge">Soon</span>
                  : state === "via gcp" ? <span className="badge info">Via GCP</span>
                  : <a href={href} className="btn secondary sm">Connect</a>}
              </div>
              <p className="small muted" style={{ marginBottom: 0 }}>{desc}</p>
              {(state === "connected" || state === "active" || state === "via gcp") && (
                <p style={{ marginBottom: 0, marginTop: 8 }}><a href={href} className="small">Manage →</a></p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="row">
        <strong className="small">{label}</strong>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? "Copied" : "Copy config"}
        </button>
      </div>
      <pre className="small" style={{ overflowX: "auto", marginTop: 6 }}>{text}</pre>
    </div>
  );
}

/** MCP for coding agents: cloud endpoint (no clone needed) or local stdio.
 *  Both expose the same tools; reads are scoped to the caller's account. */
export function McpConfigCard({ portalUrl }: { portalUrl: string }) {
  const cloud = JSON.stringify({
    mcpServers: {
      charie: {
        url: `${portalUrl}/api/mcp`,
        headers: { Authorization: "Bearer <YOUR_CHARIE_API_KEY>" },
      },
    },
  }, null, 2);
  const local = JSON.stringify({
    mcpServers: {
      charie: {
        command: "npm",
        args: ["--prefix", "services/mcp-server", "start"],
        env: { CHARIE_REPORTS: "<repo>/services/agent-engine/reports" },
      },
    },
  }, null, 2);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-title">MCP for coding agents</div>
      <p className="small muted">
        Give your coding agent (Muse Code, Cursor, Codex) the evidence Charie collected: run lists,
        findings, markdown fix packets, and verification proof. Paste either config into the agent MCP
        settings. Cloud needs no local clone; mint an API key under <a href="/team">Team and access</a> and
        replace the placeholder. Reads are scoped to your account.
      </p>
      <CopyBlock label="Cloud (hosted portal, recommended)" text={cloud} />
      <CopyBlock label="Local (stdio, from a repo checkout)" text={local} />
    </div>
  );
}

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
