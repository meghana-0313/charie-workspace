import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { ConnectorActions, ContextForm, ContextRow, JiraConnectForm, RuleForm, RuleRow } from "@/components/marketplace";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const id = await identity();
  const myUid = scopeUid(id);
  const [connectors, rules, docs] = await Promise.all([
    store.listConnectors(myUid),
    store.listSyncRules(myUid),
    store.listContextDocs(myUid),
  ]);
  const gh = id?.uid ? await store.getGithubToken(id.uid).catch(() => null) : null;
  const jiraConns = connectors.filter((c) => c.kind === "jira");
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/marketplace", "Marketplace"]]}
        title="Marketplace"
        sub="Connect the systems Charie works with. Jira issues flow in as investigated tickets; verified fixes flow back as comments and transitions."
      />
      <div className="grid2">
        <div className="card">
          <div className="card-title">GitHub</div>
          {gh ? (
            <p className="small">Connected as <strong>{gh.login ?? "you"}</strong>. Manage repos on <Link href="/repos">Test a repo</Link>.</p>
          ) : (
            <p className="small muted">Not connected. <Link href="/repos">Connect with GitHub</Link> for one-click repo access, builds, and push webhooks.</p>
          )}
        </div>
        <div className="card">
          <div className="card-title">App webhooks</div>
          <p className="small muted">
            Prod apps report errors with an ingest key (<Link href="/team">mint one</Link>): web apps drop in{" "}
            <code>/charie.js</code>, mobile apps follow <code>docs/MOBILE_SDK.md</code>.
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Jira</div>
        {jiraConns.length === 0 ? (
          <JiraConnectForm />
        ) : (
          <table>
            <thead><tr><th>Site</th><th>Status</th><th>Last sync</th><th></th></tr></thead>
            <tbody>
              {jiraConns.map((c) => (
                <tr key={c.id}>
                  <td className="small">{c.config.domain}<br /><span className="muted">{c.config.email}</span></td>
                  <td><Badge tone={c.status === "connected" ? "done" : "major"}>{c.status}</Badge></td>
                  <td className="small muted">{c.lastSyncStatus ?? c.detail ?? "never"}</td>
                  <td><ConnectorActions id={c.id} kind={c.kind} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card-title">Jira pull rules</div>
        <p className="small muted">
          Each rule pulls matching issues on a schedule, files them as Charie tickets against your app URL,
          and investigations start by themselves. Verify a fix and Charie comments the proof back on the Jira issue.
        </p>
        <RuleForm connectors={jiraConns.map((c) => ({ id: c.id, name: c.config.domain ?? c.name }))} />
        <div className="section-label">Rules ({rules.length})</div>
        {rules.length === 0 ? (
          <EmptyState title="No rules yet" body="Add one above: pick a site, a project, and the app URL to test." />
        ) : (
          <table>
            <thead><tr><th>What</th><th>Every</th><th>Last pull</th><th></th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <RuleRow
                  key={r.id} id={r.id}
                  label={`${r.jql || (r.project ? `project ${r.project}` : "all issues")} → ${r.targetUrl}`}
                  preset={r.preset} enabled={r.enabled} lastStatus={r.lastStatus}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card-title">Context for Charie</div>
        <p className="small muted">Notes and reference links that ground chat answers and investigations. Saved in your account.</p>
        <ContextForm />
        <div className="section-label">Docs ({docs.length})</div>
        {docs.length === 0 ? (
          <EmptyState title="No context yet" body="Add product notes, runbooks, or doc links above." />
        ) : (
          <table>
            <thead><tr><th>Title</th><th>Type</th><th>Preview</th><th></th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <ContextRow key={d.id} id={d.id} title={d.title} source={d.source} preview={(d.body ?? d.url ?? "").slice(0, 80)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
