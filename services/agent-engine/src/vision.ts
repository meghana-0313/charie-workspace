// Charie screen vision: describe one shared-screen frame and say where
// to click. Multimodal chat call (Meta Muse Spark first, Baseten Muse
// Spark Open second), same OpenAI-compatible image_url shape. Never
// throws; returns null so callers can say honestly that vision is off.

import { secret } from "./secrets.js";
import { hasBasetenKey, sparkOpenModelId } from "./baseten.js";

export type FetchImpl = typeof fetch;

async function visionCall(
  base: string, key: string, model: string, image: string, question: string, fetchImpl: FetchImpl,
): Promise<string> {
  const res = await fetchImpl(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `You are Charie watching a shared screen in a support call. In 2-3 short spoken sentences: say what you see, name any error or blocker, and tell the user exactly where to click or what to do next. Plain words, no markdown. Question: ${question || "What do you see?"}` },
          { type: "image_url", image_url: { url: image } },
        ],
      }],
      max_tokens: 400,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`vision upstream ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Describe a data-URI frame. Model label names the provider that answered. */
export async function describeScreen(
  image: string, question: string, fetchImpl: FetchImpl = fetch,
): Promise<{ text: string; model: string } | null> {
  if (!image.startsWith("data:image/")) return null;
  const meta = secret("META_API_KEY");
  if (meta) {
    try {
      const text = await visionCall(secret("META_API_BASE_URL") ?? "https://api.meta.ai/v1", meta, secret("META_SPARK_MODEL") ?? "muse-spark-1.3", image, question, fetchImpl);
      if (text) return { text: text.slice(0, 600), model: "muse-spark-1.3 (meta vision)" };
    } catch { /* try Baseten */ }
  }
  const baseten = secret("BASETEN_API_KEY");
  if (baseten && hasBasetenKey()) {
    try {
      const text = await visionCall(secret("SPARK_OPEN_ENDPOINT") ?? "https://inference.baseten.co/v1", baseten, sparkOpenModelId(), image, question, fetchImpl);
      if (text) return { text: text.slice(0, 600), model: `${sparkOpenModelId()} (baseten vision)` };
    } catch { /* fall through */ }
  }
  return null;
}
