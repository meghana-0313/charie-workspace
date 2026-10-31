import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, Topbar } from "@/components/shell";

export const metadata: Metadata = { title: "Agent CB · GhostQA Suite", description: "Build and Runtime Intelligence: tickets, evidence, fixes, proof." };

export const viewport = { themeColor: "#0b0c0f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const env = process.env.PORTAL_STORE === "firestore" ? "Production" : "Development";
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <div className="shell">
          <Sidebar env={env} />
          <div className="main">
            <Topbar />
            <main className="content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
