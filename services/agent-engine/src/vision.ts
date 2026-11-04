// Charie screen vision: describe one shared-screen frame and say where
// to click. Multimodal chat call (Meta Muse Spark first, Baseten Muse
// Spark Open second), same OpenAI-compatible image_url shape. Never
// throws; returns null so callers can say honestly that vision is off.

import { secret } from "./secrets.js";
import { hasBasetenKey, sparkOpenModelId } from "./baseten.js";

export type FetchImpl = typeof fetch;

async function visionCall(
  base: string, key: string, model: string, image: string, question: string, fetchImpl: FetchImpl,
  fast = false,
  maxTokensOverride?: number,
): Promise<string> {
  const res = await fetchImpl(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: fast
            ? `You are Charie watching a shared screen live. Answer in ONE short sentence (max 25 words): what is on screen right now and any error. No preamble, plain words. Question: ${question || "What do you see?"}`
            : `You are Charie watching a shared screen in a support call. In 2-3 short spoken sentences: say what you see, name any error or blocker, and tell the user exactly where to click or what to do next. If an action appears to have failed with no error visible (for example a checkout that produced no confirmation), tell them to press F12, open the Network tab, and repeat the action once, so you can read the failed request and its status (for example 500) on your next look. If DevTools is already open, read the failed request name and status from it exactly. Plain words, no markdown. Question: ${question || "What do you see?"}` },
          { type: "image_url", image_url: { url: image } },
        ],
      }],
      // Reasoning models spend tokens thinking before any visible answer;
      // 400 starved them into empty replies (the "answered empty" bug that
      // chat-agent.ts already fixed for text). Give vision real headroom.
      max_tokens: maxTokensOverride ?? (fast ? 400 : 900),
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
  // Content can be a plain string or an array of text parts. Deliberately
  // NOT reasoning_content: for vision that is the model's private scratch
  // work ("We need to answer in ONE short sentence... We must comply?")
  // and reading it aloud leaks the prompt itself - the bug users heard.
  let text = "";
  if (typeof msg?.content === "string") text = msg.content;
  else if (Array.isArray(msg?.content)) text = msg.content.map((p) => p.text ?? "").join(" ");
  text = text.trim();
  if (/^(we need to|we are charie|we should (answer|say)|we must comply|there'?s no disallowed)/i.test(text)) {
    throw new Error("model leaked its reasoning instead of answering");
  }
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
  fast = false,
): Promise<{ ok: true; text: string; model: string } | { ok: false; reason: string }> {
  if (!image.startsWith("data:image/")) return { ok: false, reason: "no image frame was captured" };
  const failures: string[] = [];
  // One retry with the full (non-fast) budget when a reasoning model spent
  // the fast budget thinking and answered empty or leaked its scratch work.
  const attempt = async (base: string, key: string, model: string): Promise<string> => {
    try {
      return await visionCall(base, key, model, image, question, fetchImpl, fast);
    } catch (e) {
      if (!/empty|leaked/.test((e as Error).message)) throw e;
      // Reasoning models spend the budget thinking and finish with
      // finish_reason=length and no visible answer - on the fast lane
      // AND on a manual look. Retry with real headroom, then once more
      // with more, before giving up and naming the failure.
      try {
        return await visionCall(base, key, model, image, question, fetchImpl, false, 2200);
      } catch (e2) {
        if (!/empty|leaked/.test((e2 as Error).message)) throw e2;
        return visionCall(base, key, model, image, question, fetchImpl, false, 4000);
      }
    }
  };
  const meta = secret("META_API_KEY");
  if (meta) {
    try {
      const text = await attempt(secret("META_API_BASE_URL") ?? "https://api.meta.ai/v1", meta, secret("META_SPARK_MODEL") ?? "muse-spark-1.3");
      if (text) return { ok: true, text: text.slice(0, 600), model: "muse-spark-1.3 (meta vision)" };
      failures.push("Meta Muse Spark answered empty");
    } catch (e) { failures.push(`Meta Muse Spark: ${(e as Error).message}`); }
  } else {
    failures.push("Meta: META_API_KEY not set on the engine");
  }
  const baseten = secret("BASETEN_API_KEY");
  if (baseten && hasBasetenKey()) {
    try {
      const text = await attempt(secret("SPARK_OPEN_ENDPOINT") ?? "https://inference.baseten.co/v1", baseten, sparkOpenModelId());
      if (text) return { ok: true, text: text.slice(0, 600), model: `${sparkOpenModelId()} (baseten vision)` };
      failures.push("Baseten Muse Spark Open answered empty");
    } catch (e) { failures.push(`Baseten Muse Spark Open: ${(e as Error).message}`); }
  } else {
    failures.push("Baseten: BASETEN_API_KEY not set on the engine");
  }
  return { ok: false, reason: failures.join("; ") };
}
