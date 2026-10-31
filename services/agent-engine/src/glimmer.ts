// M6: Muse Glimmer triage over any OpenAI-compatible endpoint.
// Default is Ollama-local (`ollama pull muse-glimmer:30b` first); point
// GLIMMER_ENDPOINT at a hosted URL (+ optional GLIMMER_API_KEY) instead.
// Falls back to the heuristic when unreachable. Never throws.

import { secret } from "./secrets.js";

export type FetchImpl = typeof fetch;

export async function glimmerComplete(
  messages: Array<{ role: "system" | "user"; content: string }>,
  opts?: { maxTokens?: number; fetchImpl?: FetchImpl; quiet?: boolean },
): Promise<string | null> {
  const base = (secret("GLIMMER_ENDPOINT") ?? "http://localhost:11434/v1").replace(/\/$/, "");
  const model = secret("GLIMMER_MODEL") ?? "muse-glimmer:30b";
  const headers: Record<string, string> = { "content-type": "application/json" };
  const key = secret("GLIMMER_API_KEY");
  if (key) headers.authorization = `Bearer ${key}`;
  try {
    const res = await (opts?.fetchImpl ?? fetch)(`${base}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 300,
        temperature: 0.1,
      }),
    });
    if (!res.ok) throw new Error(`Glimmer endpoint error: ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    if (!opts?.quiet) console.warn(`[glimmer] unreachable, heuristic kept: ${(e as Error).message}`);
    return null;
  }
}

export function parseTriage(text: string): { goal: string; grade: string } | null {
  const goal = text.match(/^GOAL:\s*(.+)$/m)?.[1]?.trim();
  const grade = text.match(/^GRADE:\s*(blocker|major|minor)\s*$/m)?.[1];
  if (!goal || !grade) return null;
  return { goal, grade };
}
