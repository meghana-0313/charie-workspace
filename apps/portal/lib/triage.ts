// Local copy of the engine triage heuristic (see services/agent-engine/src/triage.ts,
// the source of truth). Lets tickets be filed without an explicit goal.
export function extractGoal(subject: string, body: string): string {
  const text = `${subject.trim()}. ${body.trim()}`;
  const first = text.split(/[.!?\n]/).map((s) => s.trim()).filter(Boolean)[0] ?? text.trim();
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}
