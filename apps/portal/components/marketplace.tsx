// Marketplace client components: Jira connect, sync rules, context docs.

"use client";

import { useState } from "react";
import { Badge } from "./ui";

/**
 * Integration marks: neutral monogram tiles, deliberately not redrawn
 * brand logos. Hand-drawn approximations of real logos (the old switch)
 * were inaccurate (an owl for Sentry, a paw for Datadog) and recoloured
 * copies breach most vendors' mark guidelines. A letter in the brand's
 * colour beside the real product name is honest nominative use: it
 * identifies the product without claiming its logo. Charie is not
 * affiliated with or endorsed by these products.
 */
const APP_INITIALS: Record<string, string> = {
  github: "GH", gitlab: "GL", jira: "J", slack: "S", sentry: "Se", datadog: "Dd",
  aws: "AWS", gcp: "G", firebase: "F", linear: "L", discord: "D",
  azure: "Az", cloudflare: "Cf", supabase: "Sb", webhook: "</>",
};

export function AppLogo({ app }: { app: string }) {
  const initials = APP_INITIALS[app] ?? app.slice(0, 2).toUpperCase();
  return (
    <span aria-hidden style={{ fontSize: initials.length > 2 ? 9 : 11, fontWeight: 700, letterSpacing: ".02em", lineHeight: 1, fontFamily: "var(--font-sans)" }}>
      {initials}
    </span>
  );
}

const APP_COLORS: Record<string, [string, string]> = {
  github: ["#24292f", "#fff"], gitlab: ["#fc6d26", "#fff"], jira: ["#2684ff", "#fff"],
  slack: ["#611f69", "#fff"], sentry: ["#362d59", "#fff"], datadog: ["#632ca6", "#fff"],
  aws: ["#ff9900", "#232f3e"], gcp: ["#4285f4", "#fff"], firebase: ["#ffca28", "#5f4300"],
  linear: ["#5e6ad2", "#fff"], discord: ["#5865f2", "#fff"], webhook: ["#1d2a36", "#6ee7d8"],
  azure: ["#0078d4", "#fff"], cloudflare: ["#f48120", "#fff"], supabase: ["#1c1c1c", "#3ecf8e"],
};

export function AppTiles({ githubConnected, jiraConnected, azureConnected, cloudflareConnected, supabaseConnected }: {
  githubConnected: boolean; jiraConnected: boolean; azureConnected?: boolean; cloudflareConnected?: boolean; supabaseConnected?: boolean;
}) {
  const apps: Array<[string, string, string, string, string]> = [
    ["github", "GitHub", "Repos, PRs, issues and actions", githubConnected ? "connected" : "connect", "/repos"],
    ["jira", "Jira", "Sync issues, epics and sprints", jiraConnected ? "connected" : "connect", "#connect-jira"],
    ["webhook", "Webhooks", "Prod apps report errors with ingest keys", "active", "/team"],
    ["gcp", "Google Cloud", "Logs, builds and hosting via GCP", "via gcp", "/settings"],
    ["firebase", "Firebase", "Build, run and monitor apps", "via gcp", "/settings"],
    ["azure", "Azure", "Subscriptions, resources and deployments", azureConnected ? "connected" : "connect", "#connect-azure"],
    ["cloudflare", "Cloudflare", "Zones, DNS, Workers and edge deploys", cloudflareConnected ? "connected" : "connect", "#connect-cloudflare"],
    ["supabase", "Supabase", "Projects, Postgres and auth health", supabaseConnected ? "connected" : "connect", "#connect-supabase"],
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
        <span className="tab on" style={{ padding: "7px 14px" }}>All (15)</span>
        <span className="small muted" style={{ alignSelf: "center" }}>Dev & Code (4) · Cloud (5) · Monitoring (3)</span>
        <span className="spacer" />
        <span className="small muted" style={{ alignSelf: "center" }}>Only live connectors run actions; the rest are on the roadmap.</span>
      </div>
      <div className="app-tiles" style={{ marginBottom: "var(--space-4)" }}>
        {apps.map(([app, name, desc, state, href]) => {
          const [bg, fg] = APP_COLORS[app] ?? ["#202949", "#fff"];
          return (
            <div key={app} className={state === "soon" ? "app-tile is-soon" : "app-tile"} aria-disabled={state === "soon" || undefined}>
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
      <p className="small muted">Product names are trademarks of their owners. Tiles use letter marks only - Charie is not affiliated with or endorsed by these products.</p>
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
  const step = !domain.trim() ? 1 : !email.trim() ? 2 : !token.trim() ? 3 : 4;
  return (
    <form onSubmit={run}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Three short steps. Charie then pulls matching issues in as investigated tickets and sends verified
        fixes back as comments and transitions. Atlassian does not offer one-click OAuth for apps like
        Charie without admin registration, so this uses a personal API token: it stays server-side,
        is never shown again, and you can revoke it in Atlassian at any time.
      </p>
      <div className="row" style={{ gap: "var(--space-2)", marginBottom: 12 }} aria-label="Connection progress">
        {["Your site", "Your account", "Secure token"].map((label, i) => (
          <span key={label} className="row" style={{ flexWrap: "nowrap" }}>
            <span className="initials" style={{ width: 26, height: 26, background: step > i + 1 ? "var(--ok)" : step === i + 1 ? "var(--accent)" : "var(--surface-overlay)", color: "#fff" }}>{step > i + 1 ? "✓" : i + 1}</span>
            <span className="small"><strong>{label}</strong></span>
            {i < 2 && <span style={{ width: 18, height: 1, background: "var(--line-strong)" }} />}
          </span>
        ))}
      </div>
      <label htmlFor="jira-domain">Step 1: your Jira site</label>
      <input id="jira-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.atlassian.net" required />
      <label htmlFor="jira-email">Step 2: the email on your Atlassian account</label>
      <input id="jira-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
      <label htmlFor="jira-token">Step 3: API token</label>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input id="jira-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste token, stored server-side, never shown" required autoComplete="off" style={{ flex: 1 }} />
        <a className="btn secondary" href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">Create token</a>
      </div>
      <p className="field-hint">Create token → copy it → paste here. Charie tests the connection before saving.</p>
      <div className="row" style={{ marginTop: 10 }}>
        <button disabled={busy}>{busy ? "Testing connection…" : "Connect Jira"}</button>
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
      {kind !== "webhook-in" && kind !== "github" && <button type="button" className="secondary sm" disabled={busy} onClick={test}>Test</button>}
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

type VendorKindUi = "azure" | "cloudflare" | "supabase";

const VENDOR_FIELDS: Record<VendorKindUi, Array<{ key: string; label: string; placeholder: string; secret?: boolean; optional?: boolean }>> = {
  cloudflare: [
    { key: "apiToken", label: "API token", placeholder: "Cloudflare API token (stored server-side, never shown)", secret: true },
  ],
  supabase: [
    { key: "projectRef", label: "Project ref", placeholder: "abcdwxyz (from your Supabase project URL)" },
    { key: "serviceRoleKey", label: "Service role key", placeholder: "Service role key (stored server-side, never shown)", secret: true },
  ],
  azure: [
    { key: "tenantId", label: "Tenant (directory) ID", placeholder: "00000000-0000-0000-0000-000000000000" },
    { key: "clientId", label: "Application (client) ID", placeholder: "Service principal app ID" },
    { key: "clientSecret", label: "Client secret", placeholder: "Service principal secret (stored server-side, never shown)", secret: true },
    { key: "subscriptionId", label: "Subscription ID (optional)", placeholder: "Scope checks to one subscription", optional: true },
  ],
};

const VENDOR_BLURB: Record<VendorKindUi, string> = {
  cloudflare: "Charie verifies the token against Cloudflare before saving. Zone, DNS, and Worker syncs build on this connection.",
  supabase: "Charie checks project health with the service role key before saving. The key stays server-side and is never shown again.",
  azure: "Charie exchanges the service principal for an ARM token and lists visible subscriptions before saving. Secrets stay server-side.",
};

/** Connect form for Azure / Cloudflare / Supabase, cloned from the Jira
 *  test-before-save pattern: POST /api/connectors, reload on success. */
export function VendorConnectForm({ kind, label }: { kind: VendorKindUi; label: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
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
      body: JSON.stringify({ kind, ...values }),
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
      <p className="small muted" style={{ marginTop: 0 }}>{VENDOR_BLURB[kind]}</p>
      {VENDOR_FIELDS[kind].map((f) => (
        <span key={f.key}>
          <label htmlFor={`${kind}-${f.key}`}>{f.label}</label>
          <input
            id={`${kind}-${f.key}`}
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            required={!f.optional}
            value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
          />
        </span>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <button disabled={busy}>{busy ? "Testing connection…" : `Connect ${label}`}</button>
        {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
      </div>
    </form>
  );
}

/** Connected-vendor card: status table with Test / Disconnect, or the form. */
export function VendorSection({ kind, label, conns }: {
  kind: VendorKindUi;
  label: string;
  conns: Array<{ id: string; status: string; detail?: string; lastSyncStatus?: string; config: Record<string, string | undefined> }>;
}) {
  return (
    <div className="card" id={`connect-${kind}`} style={{ marginTop: 16 }}>
      <div className="card-title">{label}</div>
      {conns.length === 0 ? (
        <VendorConnectForm kind={kind} label={label} />
      ) : (
        <table>
          <thead><tr><th>Account</th><th>Status</th><th>Detail</th><th></th></tr></thead>
          <tbody>
            {conns.map((c) => (
              <tr key={c.id}>
                <td className="small">{c.config.projectRef ?? c.config.tenantId ?? c.config.subscriptionId ?? label}</td>
                <td><Badge tone={c.status === "connected" ? "done" : "major"}>{c.status}</Badge></td>
                <td className="small muted">{c.lastSyncStatus ?? c.detail ?? "never"}</td>
                <td><ConnectorActions id={c.id} kind={kind} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
