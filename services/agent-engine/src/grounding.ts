// Screenshot grounding (M3). SAM 3.1 will return bounding boxes for cited
// controls so findings point at regions, not whole screenshots.
// Until then: returns [] and callers cite the full screenshot (honest fallback).

import { secret } from "./secrets.js";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export async function groundControls(_screenshotPath: string, _labels: string[]): Promise<Box[]> {
  if (!secret("META_API_KEY")) return [];
  console.warn("[grounding] SAM 3.1 integration pending (M3); whole-screenshot citations used");
  return [];
}
