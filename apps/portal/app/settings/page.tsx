import { store } from "@/lib/store";
import { zoomStatus } from "@/lib/guardian";
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
  const repos = await store.listRepos().catch(() => []);
  const env = process.env.PORTAL_STORE === "firestore" ? "Production" : "Development";

  const rows: Array<[string, React.ReactNode, string]> = [
    ["Environment", <Badge tone={env === "Production" ? "minor" : "major"}>{env}</Badge>, process.env.PORTAL_STORE === "firestore" ? "Firestore + Cloud Storage" : "Local JSON files + uploads"],
    ["Engine service", engineOk ? <Badge tone="minor">reachable</Badge> : <Badge tone="failed">unreachable</Badge>, engineUrl],
    ["Meta models", <Badge>engine-side</Badge>, "Keys live in Secret Manager; the engine reads them at runtime. The portal never sees them."],
    ["Zoom bots", zoom?.configured ? <Badge tone="minor">connected</Badge> : <Badge>not configured</Badge>, zoom?.configured ? `${zoom.bots.length} recent bot(s)` : "Add RECALL_API_KEY to light this up."],
    ["Push alerts", process.env.VAPID_PUBLIC ? <Badge tone="minor">enabled</Badge> : <Badge>off</Badge>, `${subs.length} subscriber(s)`],
    ["GitHub repos", <Badge tone={repos.length > 0 ? "minor" : undefined}>{repos.length} connected</Badge>, "Connect a repo to build and test it here."],
    ["Scheduler", <Badge tone="minor">hourly + nightly</Badge>, "Sweep :07 past the hour, Night Shift 03:00 UTC."],
  ];

  return (
    <>
      <PageHead
        crumbs={[["/", "Overview"], ["/settings", "Settings"]]}
        title="Settings"
        sub="Environment and integrations. Secrets stay in Secret Manager; this page only reports live status."
      />
      <div className="card">
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
    </>
  );
}
