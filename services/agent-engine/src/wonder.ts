// Deep-dive tier (M5). Selects findings that need Muse Wonder - multi-component
// or low-confidence - and runs the deep root-cause analysis when configured.

import { secret } from "./secrets.js";
import type { Finding } from "./types.js";

export function needsDeepDive(f: Finding): boolean {
  return f.confidence === "low" || /multi|several|across/i.test(f.suspectedCause);
}

export async function deepDive(_f: Finding): Promise<{ rootCause: string; fixPlan: string } | null> {
  if (!secret("META_API_KEY")) return null;
  console.warn("[wonder] Muse Wonder integration pending (M5)");
  return null;
}
