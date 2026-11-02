import { store } from "@/lib/store";
import { identity, isAdmin, scopeUid } from "@/lib/who";
import { zoomStatus } from "@/lib/guardian";
import { SettingsForm } from "@/components/settings-form";
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
  const zoom = await zoomStatus();
  const subs = await store.listPushSubscriptions().catch(() => []);
  const me = await identity();
  const myUid = scopeUid(me);
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
      <div className="settings-grid">
        <div className="card">
          <div className="card-title">Workspace</div>
          <SettingsForm initial={initial} canEdit={canEdit} />
        </div>
        <div className="card">
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
      </div>
    </>
  );
}
