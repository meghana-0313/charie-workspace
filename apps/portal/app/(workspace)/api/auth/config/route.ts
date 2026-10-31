import { NextResponse } from "next/server";
import { devLoginAllowed } from "@/lib/auth";

// Public: Firebase web config (apiKey is public by design) + login options.
export async function GET() {
  let webConfig: unknown = null;
  try {
    webConfig = JSON.parse(process.env.FIREBASE_WEB_CONFIG ?? "null");
  } catch {
    webConfig = null;
  }
  const w = webConfig as { apiKey?: string; projectId?: string; appId?: string } | null;
  const configured = Boolean(w?.apiKey && w?.projectId && w?.appId);
  return NextResponse.json({
    configured,
    ...(configured ? { webConfig: w } : {}),
    devLogin: devLoginAllowed(),
    setupUrl: `https://console.firebase.google.com/project/${process.env.GCP_PROJECT_ID ?? "_"}/authentication`,
  });
}
