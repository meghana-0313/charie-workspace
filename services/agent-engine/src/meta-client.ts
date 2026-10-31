// Minimal client for the Meta Model API (OpenAI-compatible chat surface).
// Key, base URL and model IDs resolve via secrets.ts (env first, GCP Secret
// Manager second - no .env file). Model IDs verified against dev.meta.ai docs.
// When no key is present the engine falls back to heuristics.

import { secret } from "./secrets.js";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function hasMetaKey(): boolean {
  return Boolean(secret("META_API_KEY"));
}

export function modelId(kind: "spark" | "wonder" | "image" | "voice" | "sam"): string {
  if (kind === "wonder") return secret("META_WONDER_MODEL") ?? "muse-wonder-1.0";
  if (kind === "image") return secret("META_IMAGE_MODEL") ?? "muse-image-1.0";
  if (kind === "voice") return secret("META_VOICE_MODEL") ?? "muse-voice-transcribe-1.0";
  if (kind === "sam") return secret("META_SAM_MODEL") ?? "sam-3-1";
  return secret("META_SPARK_MODEL") ?? secret("META_TEXT_MODEL") ?? "muse-spark-1.3";
}

export async function chat(messages: ChatMessage[], opts?: { model?: string; maxTokens?: number }): Promise<string> {
  const key = secret("META_API_KEY");
  if (!key) throw new Error("META_API_KEY not set");
  const base = (secret("META_API_BASE_URL") ?? "https://api.meta.ai/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: opts?.model ?? modelId("spark"),
      messages,
      max_tokens: opts?.maxTokens ?? 1200,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`Meta Model API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Ask Muse Spark to enrich a heuristic finding with cause/fix prose. Never throws. */
export async function enrichFinding(input: {
  title: string;
  category: string;
  reproSteps: string[];
  signals: string[];
}): Promise<{ suspectedCause: string; suggestedFix: string } | null> {
  try {
    const out = await chat([
      {
        role: "system",
        content:
          "You are a senior QA engineer. Reply with exactly two lines: 'CAUSE: <one sentence>' then 'FIX: <one concrete instruction>'. No other text.",
      },
      {
        role: "user",
        content: `Finding: ${input.title} [${input.category}]\nRepro:\n${input.reproSteps
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n")}\nSignals: ${input.signals.join("; ")}`,
      },
    ]);
    const cause = out.match(/^CAUSE:\s*(.+)$/m)?.[1]?.trim();
    const fix = out.match(/^FIX:\s*(.+)$/m)?.[1]?.trim();
    if (!cause || !fix) return null;
    return { suspectedCause: cause, suggestedFix: fix };
  } catch (e) {
    console.warn(`[meta-client] enrichment skipped: ${(e as Error).message}`);
    return null;
  }
}
