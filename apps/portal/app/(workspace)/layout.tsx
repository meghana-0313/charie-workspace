import "../globals.css";
import { Sidebar, Topbar } from "@/components/shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const env = process.env.PORTAL_STORE === "firestore" ? "Production" : "Development";
  return (
    <div className="shell">
      <Sidebar env={env} />
      <div className="main">
        <Topbar />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
