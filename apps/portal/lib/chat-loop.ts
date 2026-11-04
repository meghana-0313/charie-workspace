// Pure helpers for the Charie chat loop: repeat detection and the
// deterministic fallback answer. No imports, so tests stay offline.

/** Stable signature for one tool call: same tool + same args = same call. */
export function toolSignature(tool: string, args: Record<string, unknown>): string {
  const keys = Object.keys(args).sort();
  return `${tool}:${keys.map((k) => `${k}=${String(args[k])}`).join(",")}`;
}

export function isRepeatCall(seen: Set<string>, tool: string, args: Record<string, unknown>): boolean {
  return seen.has(toolSignature(tool, args));
}

export interface ToolResultEntry {
  tool: string;
  result: string;
}

/**
 * Last-resort answer built only from tool results actually collected.
 * Used when the model spends its turns calling tools and never writes a
 * final reply: the user still gets the information, never a dead end.
 */
export function summarizeToolResults(results: ToolResultEntry[]): string {
  const parts = results
    .map((r) => r.result.trim())
    .filter(Boolean)
    .map((t) => (t.length > 600 ? `${t.slice(0, 600)}...` : t));
  if (parts.length === 0) {
    return "I checked, but I do not have that information in your workspace yet. Ask me to list your tickets, check a repo, or run a scan and I will get it.";
  }
  return `Here is what I found:\n${parts.join("\n")}`;
}
