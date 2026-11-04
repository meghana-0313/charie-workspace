import { NextResponse } from "next/server";
import { resolveLiveTarget, runLiveProbe } from "@/lib/live-monitor";
import { store } from "@/lib/store";
import { isDemoAccount } from "@/lib/demo-samples";
import { identity, scopeUid } from "@/lib/who";

// GET /api/guardian/live-monitor - one real probe round against the
// watched site, measured at request time. The Live Signals page polls
// this every 3 seconds; nothing here is cached or simulated.
export async function GET(req: Request) {
  const uid = scopeUid(await identity(req));
  const setting = await store.getSetting("defaultTargetUrl").catch(() => null);
  const target = resolveLiveTarget({
    envUrl: process.env.DEMO_TARGET_URL,
    settingUrl: setting,
    demo: isDemoAccount(uid),
    hosted: process.env.PORTAL_STORE === "firestore",
  });
  const probe = await runLiveProbe(target);
  return NextResponse.json(probe, { headers: { "cache-control": "no-store" } });
}
