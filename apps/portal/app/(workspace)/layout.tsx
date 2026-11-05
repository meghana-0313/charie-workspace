import "../globals.css";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { Sidebar, Topbar } from "@/components/shell";
import { DemoBanner } from "@/components/demo-banner";
import { DEMO_UID } from "@/lib/demo";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const env = process.env.PORTAL_STORE === "firestore" ? "Production" : "Development";
  const workspaceName = (await store.getSetting("workspaceName").catch(() => null)) || undefined;
  const me = await identity().catch(() => null);
  const myUid = scopeUid(me);
  const [tickets, incidents, repos] = await Promise.all([
    store.listTickets(myUid).catch(() => []),
    store.listIncidents(myUid).catch(() => []),
    store.listRepos(myUid).catch(() => []),
  ]);
  const ticketsOpen = tickets.filter((t) => t.status !== "closed" && t.status !== "verified").length;
  const incidentsOpen = incidents.filter((i) => i.status === "open").length;
  const repoName = repos[0] ? `${repos[0].owner}/${repos[0].repo}` : "Charie demo site";
  const branchName = repos[0]?.branch || "prod";
  const alerts = [
    ...incidents.filter((i) => i.status === "open").slice(0, 3).map((i) => ({ href: `/guardian/${i.id}`, label: i.title, sub: `Incident · ${i.severity}` })),
    ...tickets.filter((t) => t.status !== "closed" && t.status !== "verified").slice(0, 3).map((t) => ({ href: `/tickets/${t.id}`, label: t.subject, sub: `Ticket · ${t.status}` })),
  ];
  return (
    <div className="shell">
      <Sidebar env={env} workspaceName={workspaceName} ticketsOpen={ticketsOpen} incidentsOpen={incidentsOpen} />
      <div className="main">
        <Topbar workspaceName={workspaceName} repoName={repoName} branchName={branchName} repos={repos.map((r) => ({ id: r.id, name: `${r.owner}/${r.repo}` }))} env={env} userLabel={me?.name ?? me?.email ?? undefined} alerts={alerts} />
        {me?.uid === DEMO_UID && <DemoBanner />}
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
