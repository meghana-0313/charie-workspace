import { NextResponse } from "next/server";
import { devLoginAllowed } from "@/lib/auth";

// Public: Firebase web config (apiKey is public by design) + login options.
export async function GET(req: Request) {
  let webConfig: unknown = null;
  try {
    webConfig = JSON.parse(process.env.FIREBASE_WEB_CONFIG ?? "null");
  } catch {
    webConfig = null;
  }
  const w = webConfig as { apiKey?: string; projectId?: string; appId?: string; authDomain?: string } | null;
  const configured = Boolean(w?.apiKey && w?.projectId && w?.appId);
  // Hosted portals serve the Firebase auth handler on their own origin (see
  // the /__/auth rewrite in next.config), so report this host as authDomain.
  // That keeps Google sign-in storage first-party in strict browsers.
  const host = req.headers.get("host") ?? "";
  const authDomain = host.endsWith(".run.app") ? host : w?.authDomain;
  return NextResponse.json({
    configured,
    ...(configured ? { webConfig: { ...w, authDomain } } : {}),
    devLogin: devLoginAllowed(),
    setupUrl: `https://console.firebase.google.com/project/${process.env.GCP_PROJECT_ID ?? "_"}/authentication`,
  });
}
