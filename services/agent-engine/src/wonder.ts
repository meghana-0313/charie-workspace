// Deep-dive tier (M5). Selects findings that need Muse Wonder - multi-component
// or low-confidence - and runs the deep root-cause analysis when configured.
// Never throws: null means "kept the heuristic/Spark prose".

import { chat, modelId } from "./meta-client.js";
import { secret } from "./secrets.js";
import type { Finding } from "./types.js";
import type { FetchImpl } from "./baseten.js";

export function needsDeepDive(f: Finding): boolean {
  return f.confidence === "low" || /multi|several|across/i.test(f.suspectedCause);
}

export function parseDeepDive(text: string): { rootCause: string; fixPlan: string } | null {
  const rootCause = text.match(/^ROOTCAUSE:\s*(.+)$/m)?.[1]?.trim();
  const fixPlan = text.match(/^FIXPLAN:\s*(.+)$/m)?.[1]?.trim();
  if (!rootCause || !fixPlan) return null;
  return { rootCause, fixPlan };
}

export async function deepDive(
  f: Finding,
  fetchImpl: FetchImpl = fetch,
): Promise<{ rootCause: string; fixPlan: string } | null> {
  if (!secret("META_API_KEY")) return null;
  try {
    const out = await chat(
      [
        {
          role: "system",
          content:
            "You are a staff engineer doing root-cause analysis. Reply with exactly two lines: 'ROOTCAUSE: <one or two sentences>' then 'FIXPLAN: <ordered steps separated by semicolons>'. No other text.",
        },
        {
          role: "user",
          content: `Finding: ${f.title} [${f.category}/${f.severity}]\nRepro:\n${f.reproSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\nCurrent theory: ${f.suspectedCause}`,
        },
      ],
      { model: modelId("wonder"), maxTokens: 1500, fetchImpl },
    );
    return parseDeepDive(out);
  } catch (e) {
    console.warn(`[wonder] deep dive skipped: ${(e as Error).message}`);
    return null;
  }
}
