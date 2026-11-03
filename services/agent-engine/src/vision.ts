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
      // Reasoning models spend tokens thinking before any visible answer;
      // 400 starved them into empty replies (the "answered empty" bug that
      // chat-agent.ts already fixed for text). Give vision real headroom.
      max_tokens: 1600,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
    throw new Error(`vision upstream ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?: string | Array<{ type?: string; text?: string }> | null;
        reasoning_content?: string | null;
      };
    }>;
  };
  const choice = data.choices?.[0];
  const msg = choice?.message;
  // Content can be a plain string, an array of text parts, or - when the
  // reasoning budget ran out - only reasoning_content. Accept all three,
  // exactly like baseten.ts does for text calls.
  let text = "";
  if (typeof msg?.content === "string") text = msg.content;
  else if (Array.isArray(msg?.content)) text = msg.content.map((p) => p.text ?? "").join(" ");
  text = (text || msg?.reasoning_content || "").trim();
  if (!text) throw new Error(`answered empty (finish_reason=${choice?.finish_reason ?? "unknown"})`);
  return text;
}

/** Describe a data-URI frame. Model label names the provider that answered. */
export async function describeScreen(
  image: string, question: string, fetchImpl: FetchImpl = fetch,
): Promise<{ text: string; model: string } | null> {
  const out = await describeScreenDetailed(image, question, fetchImpl);
  return out.ok ? { text: out.text, model: out.model } : null;
}

/** Same call, but every provider failure is named so the UI can say why. */
export async function describeScreenDetailed(
  image: string, question: string, fetchImpl: FetchImpl = fetch,
): Promise<{ ok: true; text: string; model: string } | { ok: false; reason: string }> {
  if (!image.startsWith("data:image/")) return { ok: false, reason: "no image frame was captured" };
  const failures: string[] = [];
  const meta = secret("META_API_KEY");
  if (meta) {
    try {
      const text = await visionCall(secret("META_API_BASE_URL") ?? "https://api.meta.ai/v1", meta, secret("META_SPARK_MODEL") ?? "muse-spark-1.3", image, question, fetchImpl);
      if (text) return { ok: true, text: text.slice(0, 600), model: "muse-spark-1.3 (meta vision)" };
      failures.push("Meta Muse Spark answered empty");
    } catch (e) { failures.push(`Meta Muse Spark: ${(e as Error).message}`); }
  } else {
    failures.push("Meta: META_API_KEY not set on the engine");
  }
  const baseten = secret("BASETEN_API_KEY");
  if (baseten && hasBasetenKey()) {
    try {
      const text = await visionCall(secret("SPARK_OPEN_ENDPOINT") ?? "https://inference.baseten.co/v1", baseten, sparkOpenModelId(), image, question, fetchImpl);
      if (text) return { ok: true, text: text.slice(0, 600), model: `${sparkOpenModelId()} (baseten vision)` };
      failures.push("Baseten Muse Spark Open answered empty");
    } catch (e) { failures.push(`Baseten Muse Spark Open: ${(e as Error).message}`); }
  } else {
    failures.push("Baseten: BASETEN_API_KEY not set on the engine");
  }
  return { ok: false, reason: failures.join("; ") };
}
