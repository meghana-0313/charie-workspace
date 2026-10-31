// Redesign briefs for usability findings: evidence-linked improvement directions.
// Written brief v0 (heuristic, grounded in the finding); Muse Image attaches
// visual alternatives to `images` in M2.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { secret } from "./secrets.js";
import type { FetchImpl } from "./baseten.js";
import type { Finding } from "./types.js";

export interface RedesignBrief {
  findingId: string;
  directions: Array<{ name: string; change: string; tradeoff: string }>;
  componentPlan: string;
  images: string[]; // empty until M2 (Muse Image)
}

export function briefFor(f: Finding): RedesignBrief | null {
  if (f.category !== "usability") return null;
  return {
    findingId: f.id,
    directions: [
      {
        name: "Clarify in place",
        change: `Apply the approved instruction with no layout change: ${f.suggestedFix}`,
        tradeoff: "Cheapest; keeps the layout stable but may not fix discovery.",
      },
      {
        name: "Restructure the step",
        change: "Reduce competing controls to one primary action per step; demote secondary actions to text links.",
        tradeoff: "Bigger change; needs a full-journey retest before/after.",
      },
    ],
    componentPlan: `Update the component owning "${f.title}" per the approved instruction; add a regression test asserting: ${f.regressionCheck}`,
    images: [],
  };
}

/**
 * Generate 2 visual alternatives for a usability finding via Muse Image.
 * Saves PNGs under <outDir>/redesigns/ and returns their relative paths.
 * Empty array on any failure (briefs still ship the written directions).
 */
export async function generateRedesignImages(
  f: Finding,
  outDir: string,
  fetchImpl: FetchImpl = fetch,
): Promise<string[]> {
  const key = secret("META_API_KEY");
  if (!key || f.category !== "usability") return [];
  try {
    const base = (secret("META_API_BASE_URL") ?? "https://api.meta.ai/v1").replace(/\/$/, "");
    const model = secret("META_IMAGE_MODEL") ?? "muse-image-1.0";
    const res = await fetchImpl(`${base}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        prompt: `Clean modern e-commerce checkout screen redesign addressing this usability issue: ${f.title}. Apply this change: ${f.suggestedFix}. Single primary action, clear labels, visible progress.`,
        n: 2,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });
    if (!res.ok) throw new Error(`Muse Image error: ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const imgs = (data.data ?? []).filter((d) => d.b64_json);
    if (imgs.length === 0) return [];
    await mkdir(join(outDir, "redesigns"), { recursive: true });
    const paths: string[] = [];
    for (const [i, img] of imgs.entries()) {
      const rel = `redesigns/${f.id}-${i}.png`;
      await writeFile(join(outDir, rel), Buffer.from(img.b64_json as string, "base64"));
      paths.push(rel);
    }
    return paths;
  } catch (e) {
    console.warn(`[redesign] image generation skipped: ${(e as Error).message}`);
    return [];
  }
}
