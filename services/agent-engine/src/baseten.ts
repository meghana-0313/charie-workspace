// M7: Muse Spark Open second opinion via the Baseten Model API.
// The model always reasons; answers arrive in content with reasoning_content
// alongside. Independent re-grade of a Spark finding; disagreement lowers
// confidence. Never throws.

import { secret } from "./secrets.js";

export type FetchImpl = typeof fetch;

function endpoint(): string {
  return (secret("SPARK_OPEN_ENDPOINT") ?? "https://inference.baseten.co/v1").replace(/\/$/, "");
}

function model(): string {
  return secret("SPARK_OPEN_MODEL_ID") ?? "meta-models/muse-spark-open-1026";
}

export function hasBasetenKey(): boolean {
  return Boolean(secret("BASETEN_API_KEY"));
}

export function sparkOpenModelId(): string {
  return model();
}

/** One OpenAI-compatible chat completion on Muse Spark Open (Baseten). Throws on failure; callers fall back. */
export async function sparkOpenChat(
  messages: Array<{ role: string; content: string }>,
  opts?: { maxTokens?: number; temperature?: number; fetchImpl?: FetchImpl },
): Promise<string> {
  const key = secret("BASETEN_API_KEY");
  if (!key) throw new Error("BASETEN_API_KEY not set");
  const res = await (opts?.fetchImpl ?? fetch)(`${endpoint()}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model(),
      messages,
      max_tokens: opts?.maxTokens ?? 800,
      temperature: opts?.temperature ?? 0.4,
    }),
  });
  if (!res.ok) throw new Error(`Baseten error: ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export interface SecondOpinion {
  severity: "blocker" | "major" | "minor";
  note: string;
}

export function parseGrade(text: string): SecondOpinion | null {
  const sev = text.match(/^SEVERITY:\s*(blocker|major|minor)\s*$/m)?.[1];
  if (!sev) return null;
  const note = text.match(/^NOTE:\s*(.+)$/m)?.[1]?.trim() ?? "";
  return { severity: sev as SecondOpinion["severity"], note };
}

export async function secondOpinion(
  f: { title: string; category: string; severity: string; suspectedCause: string; suggestedFix: string },
  fetchImpl: FetchImpl = fetch,
): Promise<SecondOpinion | null> {
  const key = secret("BASETEN_API_KEY");
  if (!key) return null;
  try {
    const res = await fetchImpl(`${endpoint()}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: model(),
        messages: [
          {
            role: "system",
            content:
              "You are an independent QA reviewer. Reply with exactly two lines: 'SEVERITY: <blocker|major|minor>' then 'NOTE: <one sentence justifying the grade>'. No other text.",
          },
          {
            role: "user",
            content: `Finding: ${f.title} [${f.category}, graded ${f.severity}]\nSuspected cause: ${f.suspectedCause}\nSuggested fix: ${f.suggestedFix}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`Baseten error: ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; reasoning_content?: string } }>;
    };
    const msg = data.choices?.[0]?.message;
    return parseGrade(msg?.content || msg?.reasoning_content || "");
  } catch (e) {
    console.warn(`[spark-open] second opinion skipped: ${(e as Error).message}`);
    return null;
  }
}
