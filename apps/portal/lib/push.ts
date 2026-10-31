// Web Push fan-out: incident alerts + Night Shift digests to subscribed
// phones and desktops. VAPID keys come from env (VAPID_PUBLIC/PRIVATE);
// without them this module quietly no-ops and the UI says so.

import webpush from "web-push";
import { store } from "./store";

let armed = false;

function arm(): boolean {
  if (armed) return true;
  const pub = process.env.VAPID_PUBLIC ?? "";
  const priv = process.env.VAPID_PRIVATE ?? "";
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:ghostqa@localhost", pub, priv);
  armed = true;
  return true;
}

/** Best-effort broadcast. Dead endpoints (410) are pruned. Never throws. */
export async function pushToAll(title: string, body: string, url: string): Promise<number> {
  if (!arm()) return 0;
  let sent = 0;
  try {
    const subs = await store.listPushSubscriptions();
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify({ title, body, url }),
        );
        sent++;
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 410) {
          await store.deletePushSubscription(s.endpoint).catch(() => {});
        }
      }
    }
  } catch {
    /* push is advisory - never break the request */
  }
  return sent;
}
