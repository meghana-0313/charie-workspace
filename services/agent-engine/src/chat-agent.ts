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
- list_tickets {} - recent tickets (id, subject, status).
- ticket_status {"ticketId": "..."} - one ticket, its room, runs, approvals.
- file_ticket {"subject": "...", "body": "...", "targetUrl": "https://..."} - file and auto-investigate. targetUrl is required.
- start_scan {"kind": "a11y|firstrun|pentest", "targetUrl": "https://..."} - one-click scan. targetUrl required except pentest. There is no "ux" scan kind.
- A UX / redesign / user-experience review runs as an investigation: with a target URL call file_ticket with subject "UX review of <host>" and a body asking to walk the core journey as a new user and flag usability friction. Without a target URL, ask for it in a text reply.
- If the user asks for any scan or UX review without the target URL it needs, ask for that URL in a text reply. Never reply with an empty object, an unknown tool, or a scan call missing its kind or targetUrl.
- Exception: if the snapshot has a demo target (snapshot.demo.targetUrl), a scan or UX request without a URL runs against that demo target instead of asking. Say in your reply that it is the sample demo store.
- get_findings {"ticketId": "..."} - findings of the latest finished run.
- list_schedules {} - autopilot schedules and last results.
- repo_status {"repoId": "..."} - one connected repo and latest build; omit repoId for all.
- help {} - what you can do.

Product map - where things live in this workspace (Charie is the product; answer "where do I find X" from this map directly, no tool needed):
- Pentest / security scan reports: /guardian/security, and every report is also listed at /reports
- Accessibility scan reports: /a11y and /reports
- First-run test reports: /firstrun and /reports
- All reports of every kind: /reports
- Tickets and findings: /tickets and /tickets/<id>
- UX and redesign briefs: /ux
- Autopilot schedules: /autopilot
- Night shift digests: /guardian/night
- Support signal clusters: /guardian/signals
- Fix tasks / work orders: /guardian/work
- Meet rooms: /guardian/zoom
- Connected repos and builds: /repos
- Integrations and workspace context docs (where users teach Charie about their product): /marketplace
- Team seats and API keys: /team
- Workspace settings: /settings

Rules:
- One tool per turn. After a tool result arrives, use it or call the next tool.
- NEVER call the same tool twice with the same arguments. Tool results are labelled [tool_name]: if that label is already in the conversation, its answer is final - write your text reply instead of calling it again. This includes help: call help at most once per conversation, and after its result, present it as your answer.
- Normally answer with text after 1-3 tool results. Do not keep calling tools hoping for better data.
- Compound questions: answer every part. "What can you do" comes from the help result; "how is my system health" comes from the snapshot health, schedules, and repos; "how many calls this week" comes from the snapshot meet counts. If a number is not in the snapshot or a tool result, say you do not have it - never call random tools hunting for it.
- Only cite ids, URLs, statuses, and numbers that appeared in tool results or the snapshot. Never invent them.
- If the user says "try again", "try now", or "retry" after a failed result, re-issue the same tool call that was proposed or attempted earlier in the conversation (same kind, same target). Never answer a retry request with help.
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
  // Salvage, never dead-end: a model reply with imperfect JSON still
  // contains its answer as prose. Clean the scaffolding and return it -
  // "I could not parse that" for a readable answer is always wrong.
  const salvage = raw
    .replace(/```(?:json)?/g, "")
    .replace(/^\s*\{\s*"(?:tool|text)"\s*:\s*/i, "")
    .replace(/"\s*,\s*"args"\s*:\s*\{[^}]*\}\s*\}?\s*$/s, "")
    .replace(/^\s*\{\s*|\s*\}\s*$/g, "")
    .replace(/^"|"$/g, "")
    .trim()
    .slice(0, 2000);
  if (salvage.length > 2 && !/^(tool|args|text)$/i.test(salvage)) {
    return { kind: "text", text: salvage, model: "spark" };
  }
  return { kind: "text", text: "I could not parse that. Try asking for ticket status, filing a ticket, or starting a scan.", model: "heuristic" };
}

const URL_RE = /https?:\/\/[^\s)>"']+/i;
const TICKET_RE = /\btkt_[a-z0-9]+\b/i;

/** Offline router: keyword intents with the same tool contract. */
export function heuristicTurn(history: ChatTurn[], demoTargetUrl?: string): ChatTurnResult {
  const last = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const low = last.toLowerCase();
  const url = last.match(URL_RE)?.[0];
  // In Demo Mode a scan/UX ask without a URL runs against the sample
  // demo store, so a first-time user can just say "run a sample test".
  const scanUrl = url ?? demoTargetUrl;
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
  // "Try now / try again" after a failed or proposed scan re-issues that
  // exact scan (the portal turns it back into a consent card). It must
  // never degrade into a help dump the way it used to.
  if (/^(try (again|now)|retry|run it again|go ahead)\b/.test(low)) {
    for (const t of [...history].reverse()) {
      if (t.role === "user") continue;
      const m = t.content.match(/(a11y|firstrun|pentest)\s*[-:]\s*(https?:\/\/[^\s"'\)]+)/i)
        ?? t.content.match(/(accessibility|first.?run|security)\s+(?:scan\s+)?(?:on\s+)?(https?:\/\/[^\s"'\)]+)/i);
      if (m) {
        const kindWord = m[1].toLowerCase();
        const kind = kindWord.startsWith("access") || kindWord === "a11y" ? "a11y" : kindWord.startsWith("first") ? "firstrun" : kindWord === "security" ? "pentest" : kindWord;
        return { kind: "tool", tool: "start_scan", args: { kind, targetUrl: m[2].replace(/[.,;]+$/, "") }, model: "heuristic" };
      }
    }
  }
  // "Where do I find its/the report?" is a navigation question about
  // Charie itself. Answer from the product map (checking what the
  // conversation just ran), never by hunting through workspace tools -
  // and never via the repo lookup, which the word "report" used to trip.
  if (/\breport\b/.test(low) && /(where|find|locate|open|see|view|is it|is the)/.test(low)) {
    const prior = [...history].reverse().map((t) => t.content.toLowerCase()).join("\n");
    if (/(pentest|security|grade [a-f])/.test(low) || /(pentest|security re-scan|security scan)/.test(prior)) {
      return { kind: "text", text: "That security scan report is on the Security page at /guardian/security - the latest scan is at the top with every check. It is also listed with all reports at /reports (filter: Security scan).", model: "heuristic" };
    }
    if (/(a11y|accessib)/.test(low) || /(accessibility)/.test(prior)) {
      return { kind: "text", text: "That accessibility report is at /a11y - the latest scan is at the top, with history below. It is also listed at /reports (filter: Accessibility).", model: "heuristic" };
    }
    if (/(first.?run)/.test(low) || /(first run)/.test(prior)) {
      return { kind: "text", text: "That first-run report is at /firstrun - the latest test is at the top, with history below. It is also listed at /reports (filter: First run).", model: "heuristic" };
    }
    return { kind: "text", text: "All reports live at /reports - pentest, accessibility, first-run, agent runs, and incidents in one list. The latest security scan is also at /guardian/security.", model: "heuristic" };
  }
  // UX / redesign is an investigation ticket (the /ux flow), never a scan kind.
  const uxIntent = /(\bux\b|user experience|redesign)/.test(low);
  if (uxIntent && scanUrl) {
    let host = scanUrl;
    try { host = new URL(scanUrl).host; } catch { /* keep raw url */ }
    return {
      kind: "tool", tool: "file_ticket",
      args: {
        subject: `UX review of ${host}`,
        body: `Review the user experience of ${scanUrl}: walk the core journey as a new user and flag every usability issue with evidence. Draft redesign directions for the findings.`,
        targetUrl: scanUrl,
      },
      model: "heuristic",
    };
  }
  // Scan or UX intent with no target URL: ask for it, naming the real options.
  // Falling through here used to land on help or a parse dead-end.
  const scanIntent = /(a11y|accessibility|first.?run|new user|onboarding|pentest|security scan|\bscan\b|\brun\b|\btest\b|\baudit\b)/.test(low);
  if ((uxIntent || scanIntent) && !scanUrl && /(a11y|accessibility|first.?run|pentest|security|\bux\b|user experience|redesign|scan|audit)/.test(low)) {
    return {
      kind: "text",
      text: "Yes - I can run a first-run scan, an accessibility scan, a security scan, and a UX & redesign review (that one files an investigation ticket). Share the app URL and say which you want, or name more than one and I will line them up one at a time.",
      model: "heuristic",
    };
  }
  if (/(a11y|accessibility)/.test(low) && scanUrl) {
    return { kind: "tool", tool: "start_scan", args: { kind: "a11y", targetUrl: scanUrl }, model: "heuristic" };
  }
  if (/(first.?run|new user|onboarding)/.test(low) && scanUrl) {
    return { kind: "tool", tool: "start_scan", args: { kind: "firstrun", targetUrl: scanUrl }, model: "heuristic" };
  }
  if (/(sample|demo).*(scan|test|run)/.test(low) && scanUrl) {
    return { kind: "tool", tool: "start_scan", args: { kind: "firstrun", targetUrl: scanUrl }, model: "heuristic" };
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
  if (/(\brepos?\b|\bbuilds?\b|\bdeploy)/.test(low)) {
    return { kind: "tool", tool: "repo_status", args: {}, model: "heuristic" };
  }
  if (url) {
    return { kind: "text", text: `I see ${url}. Want me to file a ticket against it, or run an accessibility or first-run scan?`, model: "heuristic" };
  }
  // After a tool result with no new user message, the portal asks for a summary.
  const lastTool = [...history].reverse().find((t) => t.role === "tool");
  const lastUser = [...history].reverse().find((t) => t.role === "user");
  if (lastTool && (!lastUser || history.indexOf(lastTool) > history.indexOf(lastUser))) {
    // Tool content arrives labelled "[tool_name] ...": that label is
    // plumbing for the loop, never something to show the user.
    const cleanTool = lastTool.content.replace(/^\[[a-z_]+\]\s*/i, "");
    return { kind: "text", text: cleanTool.slice(0, 1500), model: "heuristic" };
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

function demoTargetOf(snapshot: unknown): string | undefined {
  if (typeof snapshot !== "object" || snapshot === null) return undefined;
  const demo = (snapshot as { demo?: { targetUrl?: unknown } }).demo;
  return typeof demo?.targetUrl === "string" && /^https?:\/\//.test(demo.targetUrl) ? demo.targetUrl : undefined;
}

const UNAVAILABLE = (what: string, key: string): ChatTurnResult => ({
  kind: "text",
  text: `${what} is not available right now - no live model answered. Configure ${key} on the engine, or switch the model picker back to Auto. I will not silently answer with the offline heuristic when you asked for a specific Meta model.`,
  model: "none",
});

export async function chatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const demoTarget = demoTargetOf(input.snapshot);
  if (input.model === "heuristic") return heuristicTurn(input.history, demoTarget);
  if (!hasBasetenKey() && !hasMetaKey()) {
    if (input.model === "baseten") return UNAVAILABLE("Muse Spark Open on Baseten", "BASETEN_API_KEY");
    if (input.model === "meta") return UNAVAILABLE("Muse Spark 1.3 on the Meta Model API", "META_API_KEY");
    return heuristicTurn(input.history, demoTarget);
  }
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
      // An unparseable model reply is a provider failure, not an answer:
      // route the actual user message through the heuristic instead of
      // surfacing the parse dead-end.
      if (parsed.model === "heuristic") return heuristicTurn(input.history, demoTarget);
      const label = `${sparkOpenModelId()} (baseten)`;
      return { ...parsed, model: parsed.model === "spark" ? label : parsed.model };
    } catch (e) {
      console.warn(`[chat-agent] Baseten Muse Spark Open unavailable, trying Meta: ${(e as Error).message}`);
      if (input.model === "baseten") return UNAVAILABLE("Muse Spark Open on Baseten", "BASETEN_API_KEY");
    }
  }
  if (input.model === "baseten") return UNAVAILABLE("Muse Spark Open on Baseten", "BASETEN_API_KEY");
  if (!hasMetaKey()) {
    if (input.model === "meta") return UNAVAILABLE("Muse Spark 1.3 on the Meta Model API", "META_API_KEY");
    return heuristicTurn(input.history, demoTarget);
  }
  try {
    const out = await chat(messages, { model: modelId("spark"), maxTokens: effortBudget("meta", input.effort), fetchImpl: input.fetchImpl });
    const parsed = parseTurnReply(out);
    if (parsed.model === "heuristic") return heuristicTurn(input.history, demoTarget);
    return { ...parsed, model: parsed.model === "spark" ? modelId("spark") : parsed.model };
  } catch (e) {
    console.warn(`[chat-agent] spark unavailable, heuristic fallback: ${(e as Error).message}`);
    if (input.model === "meta") return UNAVAILABLE("Muse Spark 1.3 on the Meta Model API", "META_API_KEY");
    return heuristicTurn(input.history, demoTarget);
  }
}
