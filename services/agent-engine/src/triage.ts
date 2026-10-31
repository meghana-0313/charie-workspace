// Triage: ticket text → runnable goal + severity pre-grade.
// Muse Glimmer (M6) when reachable, heuristic fallback otherwise.

import { glimmerComplete, parseTriage } from "./glimmer.js";

export function extractGoal(subject: string, body: string): string {
  const text = `${subject.trim()}. ${body.trim()}`;
  const first = text.split(/[.!?\n]/).map((s) => s.trim()).filter(Boolean)[0] ?? text.trim();
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}

export function preGrade(subject: string, body: string): "blocker" | "major" | "minor" {
  const t = `${subject} ${body}`.toLowerCase();
  if (/(data loss|payment|checkout|crash|\bdown\b|security|breach|can't log in|cannot log in)/.test(t)) return "blocker";
  if (/(slow|confus|error|fail|broken|wrong|missing|stuck)/.test(t)) return "major";
  return "minor";
}

export async function glimmerTriage(subject: string, body: string): Promise<{ goal: string; grade: string } | null> {
  const out = await glimmerComplete(
    [
      {
        role: "system",
        content:
          "You triage customer bug reports. Reply with exactly two lines: 'GOAL: <the user task to verify, max 140 chars>' then 'GRADE: <blocker|major|minor>'. No other text.",
      },
      { role: "user", content: `Subject: ${subject}\nBody: ${body}` },
    ],
    { quiet: true },
  );
  if (!out) return null;
  return parseTriage(out);
}
