// Zoom auto-join via Recall.ai: standup and incident calls get a bot that
// records, transcribes, and feeds action items back as Guardian signals.
// Without a RECALL_API_KEY the portal shows setup instructions and the
// endpoints report unconfigured - nothing pretends to join a call.

import { secret } from "./secrets.js";
import type { FetchImpl } from "./baseten.js";

export interface ZoomStatus {
  configured: boolean;
  provider: "recall.ai";
  bots: Array<{ id: string; meetingUrl: string; status: string }>;
  setup: string[];
}

export async function zoomStatus(fetchImpl: FetchImpl = fetch): Promise<ZoomStatus> {
  const setup = [
    "Create a Recall.ai account and copy the API key",
    "Store it as RECALL_API_KEY in GCP Secret Manager (engine reads versions/latest)",
    "Redeploy the engine; this panel flips to live automatically",
  ];
  const key = secret("RECALL_API_KEY");
  if (!key) return { configured: false, provider: "recall.ai", bots: [], setup };
  try {
    const res = await fetchImpl("https://us-west-2.recall.ai/api/v1/bot/", {
      headers: { authorization: `Token ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { configured: false, provider: "recall.ai", bots: [], setup: [`Recall.ai rejected the key (${res.status}); check RECALL_API_KEY`] };
    const data = (await res.json()) as { results?: Array<{ id: string; meeting_url?: string; status_changes?: Array<{ code?: string }> }> };
    return {
      configured: true,
      provider: "recall.ai",
      bots: (data.results ?? []).slice(0, 20).map((b) => ({
        id: b.id,
        meetingUrl: b.meeting_url ?? "",
        status: b.status_changes?.at(-1)?.code ?? "unknown",
      })),
      setup: [],
    };
  } catch (e) {
    return { configured: false, provider: "recall.ai", bots: [], setup: [`Recall.ai unreachable: ${(e as Error).message}`] };
  }
}

/** Dispatch a bot to a meeting. Returns the bot id. Throws when unconfigured. */
export async function joinMeeting(meetingUrl: string, fetchImpl: FetchImpl = fetch): Promise<{ id: string }> {
  const key = secret("RECALL_API_KEY");
  if (!key) throw new Error("RECALL_API_KEY not configured");
  let host = "";
  try {
    host = new URL(meetingUrl).hostname.toLowerCase();
  } catch {
    throw new Error("meetingUrl must be a valid URL");
  }
  if (!host.includes("zoom.us")) throw new Error("only zoom.us meetings are supported");
  const res = await fetchImpl("https://us-west-2.recall.ai/api/v1/bot/", {
    method: "POST",
    headers: { authorization: `Token ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ meeting_url: meetingUrl }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Recall.ai refused the bot (${res.status})`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Recall.ai gave no bot id");
  return { id: data.id };
}
