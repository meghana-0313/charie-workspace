import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "GhostQA Portal", description: "Tickets, issue rooms, runs and evidence." };

export const viewport = { themeColor: "#111827" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <header className="topbar">
          <a className="brand" href="/">GhostQA</a>
          <span className="tagline">ticket → evidence → fix → proof</span>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
