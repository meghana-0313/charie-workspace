import "../globals.css";
import { store } from "@/lib/store";
import { Sidebar, Topbar } from "@/components/shell";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const env = process.env.PORTAL_STORE === "firestore" ? "Production" : "Development";
  const workspaceName = (await store.getSetting("workspaceName").catch(() => null)) || undefined;
  return (
    <div className="shell">
      <Sidebar env={env} workspaceName={workspaceName} />
      <div className="main">
        <Topbar />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
