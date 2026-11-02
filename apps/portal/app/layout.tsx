import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/components/theme";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Charie: Autonomous Engineering Intelligence",
  description:
    "Meet CHARIE, your software's autonomous companion. Ticket to evidence to fix to proof: autonomous QA, a 35-check bug bounty grade security suite, live production monitoring, video support calls with live notes, and an MCP bridge for your coding agent. Powered by Meta Muse models.",
  keywords: ["Charie", "autonomous engineering", "AI QA", "Muse Spark", "Meta Model API", "penetration testing", "bug bounty", "MCP", "production monitoring"],
  authors: [{ name: "Charie" }],
  openGraph: {
    title: "Charie: Autonomous Engineering Intelligence",
    description: "Ticket to evidence to fix to proof. Autonomous QA, security, and production intelligence on Meta Muse models.",
    type: "website",
    siteName: "Charie",
    images: [{ url: "/icon.svg", alt: "Charie" }],
  },
  twitter: {
    card: "summary",
    title: "Charie: Autonomous Engineering Intelligence",
    description: "Your software's autonomous companion. Ticket to evidence to fix to proof.",
    images: ["/icon.svg"],
  },
  robots: { index: true, follow: true },
};

export const viewport = { themeColor: "#0b0c0f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
