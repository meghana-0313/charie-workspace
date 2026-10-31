import type { Metadata } from "next";
import "./globals.css";
import { themeInitScript } from "@/components/theme";

export const metadata: Metadata = { title: "Charie · Autonomous Engineering Intelligence", description: "Meet CHARIE. Your software's autonomous companion: testing, security, production intelligence." };

export const viewport = { themeColor: "#0b0c0f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
