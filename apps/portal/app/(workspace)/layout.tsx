import "../globals.css";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { Sidebar, Topbar } from "@/components/shell";

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
  const repoName = repos[0] ? `${repos[0].owner}/${repos[0].repo}` : undefined;
  return (
    <div className="shell">
      <Sidebar env={env} workspaceName={workspaceName} ticketsOpen={ticketsOpen} incidentsOpen={incidentsOpen} />
      <div className="main">
        <Topbar workspaceName={workspaceName} repoName={repoName} env={env} userLabel={me?.name ?? me?.email ?? undefined} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
