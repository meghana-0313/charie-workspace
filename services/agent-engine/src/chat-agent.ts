// Charie chat: one agentic turn over Muse Spark (Meta Model API).
// Stateless pure reasoning: the portal drives the loop and executes tools.
// Contract (verifiable-agents style, one action per turn):
//   input: history + workspace snapshot + context notes
//   output: { kind: "tool", tool, args } | { kind: "text", text }
// Tools run in the portal, never here: list_tickets, ticket_status,
// file_ticket, start_scan, get_findings, list_schedules, repo_status, help.
// Provider order for chat turns: Baseten Muse Spark Open when
// BASETEN_API_KEY resolves (user Baseten credits), then Meta Muse Spark
// (META_API_KEY), then the free heuristic router. The model field always
// names the provider that actually answered.

import { chat, hasMetaKey, modelId } from "./meta-client.js";
import { hasBasetenKey, sparkOpenChat, sparkOpenModelId } from "./baseten.js";
import type { FetchImpl } from "./baseten.js";

export type ChatRole = "user" | "assistant" | "tool";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export type ChatToolName =
  | "list_tickets"
  | "ticket_status"
  | "file_ticket"
  | "start_scan"
  | "get_findings"
  | "list_schedules"
  | "repo_status"
  | "help";

export const CHAT_TOOLS: ChatToolName[] = [
  "list_tickets",
  "ticket_status",
  "file_ticket",
  "start_scan",
  "get_findings",
  "list_schedules",
  "repo_status",
  "help",
];

export interface ChatTurnResult {
  kind: "tool" | "text";
  tool?: ChatToolName;
  args?: Record<string, unknown>;
  text?: string;
  model: string; // serving model id, or "heuristic"
}

const SYSTEM = `You are Charie, an autonomous engineering teammate inside the Charie workspace.
You act through tools, one per turn. Never answer from memory about workspace state: call a tool first.

Reply with exactly one JSON object, no other text:
- To act: {"tool": "<name>", "args": {...}}
- To answer: {"text": "<answer>"}

Tools:
- list_tickets {} — recent tickets (id, subject, status).
- ticket_status {"ticketId": "..."} — one ticket, its room, runs, approvals.
- file_ticket {"subject": "...", "body": "...", "targetUrl": "https://..."} — file and auto-investigate. targetUrl is required.
- start_scan {"kind": "a11y|firstrun|pentest", "targetUrl": "https://..."} — one-click scan. targetUrl required except pentest.
- get_findings {"ticketId": "..."} — findings of the latest finished run.
- list_schedules {} — autopilot schedules and last results.
- repo_status {"repoId": "..."} — one connected repo and latest build; omit repoId for all.
- help {} — what you can do.

Rules:
- One tool per turn. After a tool result arrives, use it or call the next tool.
- Only cite ids, URLs, statuses, and numbers that appeared in tool results or the snapshot. Never invent them.
- If the request needs a target URL you do not have, ask for it in a text reply.
- Approvals, dispatches, verifies, pushes, and external writes happen on the ticket page by a human: link there, never claim you did them.
- You are also a normal conversational assistant: greetings, general knowledge, small talk, and questions unrelated to work get a direct friendly text answer, no tool needed. Never refuse a question just because it is not about tickets.
- Keep workspace text replies short. Link tickets as /tickets/<id>, repos as /repos/<id>.
- Sound like a real teammate, not a report: natural contractions, plain words, no corporate filler. When the snapshot says the surface is a live call, answer in one or two short spoken sentences with no markdown, lists, links, or ids read aloud.`;

function snapshotBlock(snapshot: unknown): string {
  if (!snapshot) return "Snapshot: (empty)";
  try {
    return `Snapshot:\n${JSON.stringify(snapshot).slice(0, 4000)}`;
  } catch {
    return "Snapshot: (unreadable)";
  }
}

function contextBlock(notes: string[] | undefined): string {
  const clean = (notes ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 5);
  if (clean.length === 0) return "";
  return `\nWorkspace notes:\n${clean.map((n) => `- ${n.slice(0, 500)}`).join("\n")}`;
}

/** Strict parse of one Spark reply. Anything off-shape becomes a clarification. */
export function parseTurnReply(raw: string): ChatTurnResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    // A plain-text reply is a normal conversational answer, not an error.
    const plain = raw.trim().slice(0, 2000);
    if (plain) return { kind: "text", text: plain, model: "spark" };
    return { kind: "text", text: "I could not parse that. Try asking for ticket status, filing a ticket, or starting a scan.", model: "heuristic" };
  }
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as { tool?: unknown; args?: unknown; text?: unknown };
    if (typeof j.tool === "string" && (CHAT_TOOLS as string[]).includes(j.tool)) {
      const args = j.args && typeof j.args === "object" && !Array.isArray(j.args) ? (j.args as Record<string, unknown>) : {};
      return { kind: "tool", tool: j.tool as ChatToolName, args, model: "spark" };
    }
    if (typeof j.text === "string" && j.text.trim()) {
      return { kind: "text", text: j.text.trim().slice(0, 2000), model: "spark" };
    }
  } catch {
    /* fall through */
  }
  const readable = raw.slice(start, end + 1).match(/"text"\s*:\s*"([^"]+)"/)?.[1]?.trim();
  if (readable) return { kind: "text", text: readable.slice(0, 2000), model: "spark" };
  return { kind: "text", text: "I could not parse that. Try asking for ticket status, filing a ticket, or starting a scan.", model: "heuristic" };
}

const URL_RE = /https?:\/\/[^\s)>"']+/i;
const TICKET_RE = /\btkt_[a-z0-9]+\b/i;

/** Offline router: keyword intents with the same tool contract. */
export function heuristicTurn(history: ChatTurn[]): ChatTurnResult {
  const last = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const low = last.toLowerCase();
  const url = last.match(URL_RE)?.[0];
  const ticketId = last.match(TICKET_RE)?.[0];

  if (/\b(help|what can you)\b/.test(low) && low.length < 60) {
    return { kind: "tool", tool: "help", args: {}, model: "heuristic" };
  }
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(low) && low.length < 60) {
    return { kind: "text", text: "Hey! I am doing well, thanks. Ask me anything - work or otherwise - and I will help.", model: "heuristic" };
  }
  if (ticketId && /(finding|result|report)/.test(low)) {
    return { kind: "tool", tool: "get_findings", args: { ticketId }, model: "heuristic" };
  }
  if (ticketId) {
    return { kind: "tool", tool: "ticket_status", args: { ticketId }, model: "heuristic" };
  }
  if (/(a11y|accessibility)/.test(low) && url) {
    return { kind: "tool", tool: "start_scan", args: { kind: "a11y", targetUrl: url }, model: "heuristic" };
  }
  if (/(first.?run|new user|onboarding)/.test(low) && url) {
    return { kind: "tool", tool: "start_scan", args: { kind: "firstrun", targetUrl: url }, model: "heuristic" };
  }
  if (/(pentest|security scan|vulnerab)/.test(low)) {
    return { kind: "tool", tool: "start_scan", args: url ? { kind: "pentest", targetUrl: url } : { kind: "pentest" }, model: "heuristic" };
  }
  if (/(file|create|open|new).*(ticket|bug|issue)/.test(low) && url) {
    return {
      kind: "tool", tool: "file_ticket",
      args: { subject: last.slice(0, 120), body: last.slice(0, 500), targetUrl: url },
      model: "heuristic",
    };
  }
  if (/(file|create|open|new).*(ticket|bug|issue)/.test(low)) {
    return { kind: "text", text: "I can file that. Which app URL should I investigate?", model: "heuristic" };
  }
  if (/(scan|test|check|audit).*(this|that|it|app|site|url)/.test(low) && url) {
    return { kind: "tool", tool: "start_scan", args: { kind: "a11y", targetUrl: url }, model: "heuristic" };
  }
  if (/(scan|test|check|audit)/.test(low) && url) {
    return { kind: "tool", tool: "start_scan", args: { kind: "a11y", targetUrl: url }, model: "heuristic" };
  }
  if (/(ticket|bug|issue)/.test(low)) {
    return { kind: "tool", tool: "list_tickets", args: {}, model: "heuristic" };
  }
  if (/(schedul|autopilot|nightly|cron)/.test(low)) {
    return { kind: "tool", tool: "list_schedules", args: {}, model: "heuristic" };
  }
  if (/(repo|build|deploy)/.test(low)) {
    return { kind: "tool", tool: "repo_status", args: {}, model: "heuristic" };
  }
  if (url) {
    return { kind: "text", text: `I see ${url}. Want me to file a ticket against it, or run an accessibility or first-run scan?`, model: "heuristic" };
  }
  // After a tool result with no new user message, the portal asks for a summary.
  const lastTool = [...history].reverse().find((t) => t.role === "tool");
  const lastUser = [...history].reverse().find((t) => t.role === "user");
  if (lastTool && (!lastUser || history.indexOf(lastTool) > history.indexOf(lastUser))) {
    return { kind: "text", text: lastTool.content.slice(0, 1500), model: "heuristic" };
  }
  return { kind: "tool", tool: "help", args: {}, model: "heuristic" };
}

export type ChatModelChoice = "auto" | "baseten" | "meta" | "heuristic";
export type ChatEffort = "low" | "medium" | "high";

export interface ChatTurnInput {
  history: ChatTurn[];
  snapshot?: unknown;
  contextNotes?: string[];
  fetchImpl?: FetchImpl;
  model?: ChatModelChoice;
  effort?: ChatEffort;
}

/** Thinking-token budget by provider and effort (Baseten reasoning eats budget first). */
export function effortBudget(provider: "baseten" | "meta", effort: ChatEffort = "medium"): number {
  if (provider === "baseten") return effort === "low" ? 1200 : effort === "high" ? 5000 : 2500;
  return effort === "low" ? 400 : effort === "high" ? 2000 : 800;
}

export async function chatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  if (input.model === "heuristic") return heuristicTurn(input.history);
  if (!hasBasetenKey() && !hasMetaKey()) return heuristicTurn(input.history);
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: `${SYSTEM}\n\n${snapshotBlock(input.snapshot)}${contextBlock(input.contextNotes)}` },
  ];
  for (const t of input.history.slice(-12)) {
    if (t.role === "assistant") messages.push({ role: "user", content: `ASSISTANT SAID: ${t.content}` });
    else if (t.role === "tool") messages.push({ role: "user", content: `TOOL RESULT: ${t.content}` });
    else messages.push({ role: "user", content: t.content });
  }
  // Baseten first unless the user picked Meta: Muse Spark Open on Baseten credits.
  if (hasBasetenKey() && input.model !== "meta") {
    try {
      const meetCall = typeof input.snapshot === "object" && input.snapshot !== null && (input.snapshot as { surface?: string }).surface === "meet-call";
      const out = await sparkOpenChat(messages, { maxTokens: meetCall ? 1200 : effortBudget("baseten", input.effort), temperature: 0.4, fetchImpl: input.fetchImpl });
      const parsed = parseTurnReply(out);
      const label = `${sparkOpenModelId()} (baseten)`;
      return { ...parsed, model: parsed.model === "spark" ? label : parsed.model };
    } catch (e) {
      console.warn(`[chat-agent] Baseten Muse Spark Open unavailable, trying Meta: ${(e as Error).message}`);
    }
  }
  if (!hasMetaKey()) return heuristicTurn(input.history);
  try {
    const out = await chat(messages, { model: modelId("spark"), maxTokens: effortBudget("meta", input.effort), fetchImpl: input.fetchImpl });
    const parsed = parseTurnReply(out);
    return { ...parsed, model: parsed.model === "spark" ? modelId("spark") : parsed.model };
  } catch (e) {
    console.warn(`[chat-agent] spark unavailable, heuristic fallback: ${(e as Error).message}`);
    return heuristicTurn(input.history);
  }
}
