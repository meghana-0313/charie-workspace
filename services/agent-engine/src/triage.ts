// Triage: ticket text → runnable goal + severity pre-grade.
// Heuristic v0; Muse Glimmer takes over via GLIMMER_ENDPOINT in M6.

import { secret } from "./secrets.js";

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

export async function glimmerTriage(_subject: string, _body: string): Promise<{ goal: string; grade: string } | null> {
  if (!secret("GLIMMER_ENDPOINT")) return null;
  console.warn("[triage] Muse Glimmer endpoint set but integration pending (M6); heuristic used");
  return null;
}
