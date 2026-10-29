// Redesign briefs for usability findings: evidence-linked improvement directions.
// Written brief v0 (heuristic, grounded in the finding); Muse Image attaches
// visual alternatives to `images` in M2.

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
