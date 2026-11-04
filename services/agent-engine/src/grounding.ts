// Screenshot grounding (M3). SAM 3.1 returns bounding boxes for cited
// controls so findings point at regions, not whole screenshots.
// Requests go over the Responses API (non-streaming); one noun phrase per
// call. Empty array on any failure (callers cite the full shot instead).

import { readFile } from "node:fs/promises";
import { secret } from "./secrets.js";
import type { FetchImpl } from "./baseten.js";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

const BOX_RE = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)\|>/g;

export function parseBoxes(text: string, label: string): Box[] {
  const boxes: Box[] = [];
  for (const m of text.matchAll(BOX_RE)) {
    const [, x1, y1, x2, y2] = m.map(Number);
    if (x2 > x1 && y2 > y1) boxes.push({ x: x1, y: y1, width: x2 - x1, height: y2 - y1, label });
  }
  return boxes;
}

/** Collect output_text strings from a Responses API payload, defensively. */
export function extractOutputText(data: unknown): string {
  const texts: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }
    if (node && typeof node === "object") {
      const rec = node as Record<string, unknown>;
      if (rec.type === "output_text" && typeof rec.text === "string") texts.push(rec.text);
      for (const v of Object.values(rec)) walk(v);
    }
  };
  walk(data);
  return texts.join("\n");
}

export async function groundControls(
  screenshotPath: string,
  labels: string[],
  fetchImpl: FetchImpl = fetch,
): Promise<Box[]> {
  const key = secret("META_API_KEY");
  if (!key || labels.length === 0) return [];
  let b64: string;
  try {
    b64 = (await readFile(screenshotPath)).toString("base64");
  } catch {
    return [];
  }
  const base = (secret("META_API_BASE_URL") ?? "https://api.meta.ai/v1").replace(/\/$/, "");
  const model = secret("META_SAM_MODEL") ?? "sam-3-1";
  const boxes: Box[] = [];
  for (const label of labels.slice(0, 3)) {
    try {
      const res = await fetchImpl(`${base}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          input: [
            {
              type: "message",
              role: "user",
              content: [
                { type: "input_text", text: label },
                { type: "input_image", image_url: `data:image/png;base64,${b64}` },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`SAM error: ${res.status}`);
      boxes.push(...parseBoxes(extractOutputText(await res.json()), label));
    } catch (e) {
      console.warn(`[grounding] ${label}: ${(e as Error).message}`);
    }
  }
  return boxes;
}
