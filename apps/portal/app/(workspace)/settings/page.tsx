import { store } from "@/lib/store";
import { identity, isAdmin, scopeUid } from "@/lib/who";
import { zoomStatus } from "@/lib/guardian";
import { SettingsForm } from "@/components/settings-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { AccountForm } from "@/components/account-form";
import { LogoutButton, ThemeToggle } from "@/components/theme";
import { Icon } from "@/components/icons";
import { Badge, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const engineUrl = (process.env.ENGINE_URL ?? "http://localhost:3103").replace(/\/$/, "");
  let engineOk = false;
  try {
    const r = await fetch(`${engineUrl}/health`, { signal: AbortSignal.timeout(10000) });
    engineOk = r.ok;
  } catch {
    engineOk = false;
  }
  const subs = await store.listPushSubscriptions().catch(() => []);
  const me = await identity();
  const myUid = scopeUid(me);
  const zoom = await zoomStatus(myUid);
  const repos = await store.listRepos(myUid).catch(() => []);
  const env = process.env.PORTAL_STORE === "firestore" ? "Production" : "Development";
  const canEdit = await isAdmin(store).catch(() => false);
  const initial = {
    workspaceName: (await store.getSetting("workspaceName").catch(() => null)) ?? "",
    defaultTargetUrl: (await store.getSetting("defaultTargetUrl").catch(() => null)) ?? "",
    prodProjectId: (await store.getSetting("prodProjectId").catch(() => null)) ?? "",
    autopilotPaused: (await store.getSetting("autopilotPaused").catch(() => null)) ?? "0",
  };

  const rows: Array<[string, React.ReactNode, string]> = [
    ["Environment", <Badge tone={env === "Production" ? "minor" : "major"}>{env}</Badge>, process.env.PORTAL_STORE === "firestore" ? "Firestore + Cloud Storage" : "Local JSON files + uploads"],
    ["Engine service", engineOk ? <Badge tone="minor">reachable</Badge> : <Badge tone="failed">unreachable</Badge>, engineUrl],
    ["Meta models", <Badge>engine-side</Badge>, "Keys live in Secret Manager; the engine reads them at runtime. The portal never sees them."],
    ["Meet rooms", <Badge tone="minor">built in</Badge>, "Native video rooms need no setup."],
    ["Zoom fallback", zoom?.configured ? <Badge tone="minor">connected</Badge> : <Badge>not configured</Badge>, zoom?.configured ? `${zoom.bots.length} recent bot(s)` : "Add RECALL_API_KEY to light this up."],
    ["Push alerts", process.env.VAPID_PUBLIC ? <Badge tone="minor">enabled</Badge> : <Badge>off</Badge>, `${subs.length} subscriber(s)`],
    ["GitHub repos", <Badge tone={repos.length > 0 ? "minor" : undefined}>{repos.length} connected</Badge>, "Connect a repo to build and test it here."],
    ["Autopilot", <Badge tone="minor">schedules + tick</Badge>, "Recurring runs on the Autopilot page; Cloud Scheduler ticks /api/cron/tick in prod."],
  ];

  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/settings", "Settings"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="gear" size={19} /></span> Settings</>}
        sub="Make the workspace yours, then check that everything underneath is healthy. Secrets stay in Secret Manager; this page never sees them."
      />
      <SettingsTabs>
          <div className="card" id="general">
            <div className="card-title">General</div>
            <p className="small muted" style={{ marginTop: 0 }}>Workspace identity and the defaults new work starts from. Saved values apply to your whole account.</p>
            <SettingsForm initial={initial} canEdit={canEdit} />
          </div>

          <div className="card" id="appearance">
            <div className="card-title">Appearance</div>
            <div className="switch-row">
              <span style={{ flex: 1 }}><strong className="small">Theme</strong><br /><span className="small muted">Dark war-room or light. Your choice is saved on this device and follows the reference design in both modes.</span></span>
              <ThemeToggle />
            </div>
          </div>

          <div className="card" id="connections">
            <div className="card-title">Connections</div>
            <table>
              <thead><tr><th>Service</th><th>Status</th><th></th></tr></thead>
              <tbody>
                <tr>
                  <td><strong className="small">GitHub</strong><br /><span className="small muted">One-click repo connect, builds, PR fixes</span></td>
                  <td><Badge tone={repos.length > 0 ? "minor" : undefined}>{repos.length > 0 ? `${repos.length} repo(s)` : "Not connected"}</Badge></td>
                  <td><a className="btn secondary sm" href="/repos">Manage</a></td>
                </tr>
                <tr>
                  <td><strong className="small">Jira and connectors</strong><br /><span className="small muted">Issue sync, MCP for coding agents, context docs</span></td>
                  <td><Badge>Manage in Integrations</Badge></td>
                  <td><a className="btn secondary sm" href="/marketplace">Manage</a></td>
                </tr>
                <tr>
                  <td><strong className="small">App ingest keys</strong><br /><span className="small muted">Web and mobile SDKs report prod errors</span></td>
                  <td><Badge>Per app keys</Badge></td>
                  <td><a className="btn secondary sm" href="/team">Manage</a></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card" id="autopilot">
            <div className="card-title">Autopilot</div>
            <div className="switch-row">
              <span style={{ flex: 1 }}><strong className="small">Autonomous schedules</strong><br /><span className="small muted">Sweeps, night shift, and repo retests that run without you. The master pause lives in General above.</span></span>
              <Badge tone={initial.autopilotPaused === "1" ? "major" : "minor"}>{initial.autopilotPaused === "1" ? "Paused" : "Active"}</Badge>
            </div>
            <p style={{ marginBottom: 0 }}><a className="btn secondary" href="/autopilot">Open Autopilot</a></p>
          </div>

          <div className="card" id="system">
            <div className="card-title">System status</div>
            <table>
              <thead><tr><th>Area</th><th>Status</th><th>Detail</th></tr></thead>
              <tbody>
                {rows.map(([area, status, detail]) => (
                  <tr key={area}>
                    <td><strong>{area}</strong></td>
                    <td>{status}</td>
                    <td className="small muted">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" id="account">
            <div className="card-title">Account</div>
            <div className="switch-row">
              <span className="avatar-dot">{(me?.name ?? me?.email ?? "Y").slice(0, 1).toUpperCase()}</span>
              <span style={{ flex: 1 }}><strong className="small">{me?.name ?? "You"}</strong><br /><span className="small muted">{me?.email ?? ""} · {canEdit ? "Workspace admin" : "Member"} · everything you do saves to this account</span></span>
              <LogoutButton />
            </div>
            <hr className="divider" />
            <AccountForm initialName={me?.name ?? ""} email={me?.email ?? ""} />
          </div>
      </SettingsTabs>
    </>
  );
}
