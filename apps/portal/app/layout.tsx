import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "GhostQA Portal", description: "Tickets, issue rooms, runs and evidence." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
