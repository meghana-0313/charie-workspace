// Consent rules for Charie chat: which tool calls change the world and
// therefore need a human Approve click before they run. Read-only tools
// (status, lists, findings) run immediately; writes never run silently.

export const CONSENT_TOOLS = ["file_ticket", "start_scan"] as const;

export function needsConsent(tool: string): boolean {
  return (CONSENT_TOOLS as readonly string[]).includes(tool);
}

export interface ConsentCard {
  id: string;
  tool: string;
  title: string;
  detail: string;
  status: "pending" | "approved" | "denied" | "done" | "failed";
  result?: string;
}

const TITLES: Record<string, string> = {
  file_ticket: "File a ticket and start an investigation",
  start_scan: "Run a scan",
};

/** Human-readable card for a proposed tool call. */
export function consentCard(tool: string, args: Record<string, unknown>): ConsentCard {
  const parts = Object.values(args).map((v) => String(v).slice(0, 80)).filter(Boolean);
  return {
    id: `consent_${Math.random().toString(36).slice(2, 10)}`,
    tool,
    title: TITLES[tool] ?? `Run ${tool}`,
    detail: parts.length > 0 ? parts.join(" - ") : tool,
    status: "pending",
  };
}
