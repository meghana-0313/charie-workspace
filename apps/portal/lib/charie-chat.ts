// Charie chat loop (portal side): drive engine reasoning turns, execute
// tools against the store and engine bridges, persist threads per account.
// Bounded: max 5 tool turns, then the last text wins.

import { store } from "./store";
import { consentCard, needsConsent, type ConsentCard } from "./consent";
import { readFindings } from "./engine";
import { runA11y, runFirstRun, runPentest } from "./guardian";
import { fileTicketAndInvestigate } from "./tickets";
import { isRepeatCall, summarizeToolResults, toolSignature, type ToolResultEntry } from "./chat-loop";

const ENGINE_TIMEOUT = 60000;

function engineBase(): string {
  return (process.env.ENGINE_URL ?? "http://localhost:3103").replace(/\/$/, "");
}

function engineHeaders(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ENGINE_TOKEN) h["x-engine-token"] = process.env.ENGINE_TOKEN;
  return h;
}

export interface LoopTurn {
  role: "user" | "assistant" | "tool";
  content: string;
}

interface EngineTurn {
  kind: "tool" | "text";
  tool?: string;
  args?: Record<string, unknown>;
  text?: string;
  model?: string;
}

async function engineTurn(history: LoopTurn[], snapshot: unknown, contextNotes: string[], choice?: { model?: string; effort?: string }): Promise<EngineTurn | null> {
  try {
    const res = await fetch(`${engineBase()}/chat/turn`, {
      method: "POST",
      headers: engineHeaders(),
      body: JSON.stringify({ history, snapshot, contextNotes, model: choice?.model, effort: choice?.effort }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT),
    });
    if (!res.ok) return null;
    return (await res.json()) as EngineTurn;
  } catch {
    return null;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function validUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

const HELP = [
  "I can: list tickets and their status, read findings, file tickets that investigate themselves,",
  "run accessibility / first-run / security scans, list autopilot schedules, and check repo builds.",
  "Approvals, dispatches, verifies, and pushes stay with you on the ticket page.",
  "Try: 'status of tkt_x', 'file a bug for https://...', 'scan https://... for a11y'.",
].join(" ");

async function executeTool(tool: string, args: Record<string, unknown>, uid: string | undefined): Promise<string> {
  switch (tool) {
    case "help":
      return HELP;
    case "list_tickets": {
      const tickets = (await store.listTickets(uid)).slice(0, 8);
      if (tickets.length === 0) return "No tickets yet. File one with a subject, description, and app URL.";
      return tickets.map((t) => `${t.id} · ${t.subject} · ${t.status}`).join("\n");
    }
    case "ticket_status": {
      const ticket = await store.getTicket(str(args.ticketId));
      if (!ticket) return `No ticket ${str(args.ticketId)}.`;
      if (uid && ticket.uid && ticket.uid !== uid) return `No ticket ${str(args.ticketId)}.`;
      const room = ticket.roomId ? await store.getRoom(ticket.roomId) : null;
      const approvals = ticket.roomId ? await store.listApprovals(ticket.roomId) : [];
      return [
        `${ticket.id} · ${ticket.subject} · ${ticket.status}`,
        `target ${ticket.targetUrl} · goal: ${ticket.goal}`,
        `runs: ${room?.runIds.length ?? 0} · approvals: ${approvals.length}`,
        `open /tickets/${ticket.id}`,
      ].join("\n");
    }
    case "file_ticket": {
      const targetUrl = validUrl(args.targetUrl);
      const subject = str(args.subject).trim();
      const body = str(args.body).trim() || subject;
      if (!subject || !targetUrl) return "Need a subject and a valid http(s) targetUrl to file.";
      const { ticket, runId } = await fileTicketAndInvestigate({ subject: subject.slice(0, 140), body: body.slice(0, 1000), targetUrl, ownerUid: uid });
      return `Filed ${ticket.id} (${runId ? "investigating now" : "engine unreachable, run it from the ticket page"}). Open /tickets/${ticket.id}`;
    }
    case "start_scan": {
      const kind = str(args.kind);
      if (kind !== "a11y" && kind !== "firstrun" && kind !== "pentest") return "kind must be a11y, firstrun, or pentest.";
      if (kind === "a11y" || kind === "firstrun") {
        const targetUrl = validUrl(args.targetUrl);
        if (!targetUrl) return "Need a valid http(s) targetUrl for this scan.";
        const r = kind === "a11y" ? await runA11y(targetUrl, uid) : await runFirstRun(targetUrl, uid);
        if (!r) return "Engine unreachable. Try again in a bit.";
        return "grade" in r
          ? `Accessibility: grade ${r.grade}, ${r.passed}/${r.passed + r.failed} checks. Details on /a11y.`
          : `First run: score ${r.score}, ${r.passed}/${r.passed + r.failed} steps. Details on /firstrun.`;
      }
      const r = await runPentest(uid);
      if (!r) return "Engine unreachable. Try again in a bit.";
      return `Security re-scan: grade ${r.grade}, ${r.passed}/${r.passed + r.failed} checks. Details on /guardian/security.`;
    }
    case "get_findings": {
      const ticket = await store.getTicket(str(args.ticketId));
      if (!ticket || (uid && ticket.uid && ticket.uid !== uid)) return `No ticket ${str(args.ticketId)}.`;
      const room = ticket.roomId ? await store.getRoom(ticket.roomId) : null;
      const runIds = [...(room?.runIds ?? [])].reverse();
      for (const runId of runIds) {
        const findings = await readFindings(runId).catch(() => null);
        if (findings && findings.length > 0) {
          return findings.slice(0, 10).map((f) => `${f.id} [${f.severity}] ${f.title}`).join("\n");
        }
      }
      return `No finished findings for ${ticket.id} yet. The run may still be going.`;
    }
    case "list_schedules": {
      const all = await store.listSchedules(uid);
      if (all.length === 0) return "No autopilot schedules. Add some on /autopilot.";
      return all.map((s) => `${s.kind} ${s.preset} ${s.enabled ? "on" : "paused"} · last: ${s.lastStatus ?? "never"}`).join("\n");
    }
    case "repo_status": {
      const repoId = str(args.repoId);
      if (repoId) {
        const repo = await store.getRepo(repoId);
        if (!repo || (uid && repo.uid && repo.uid !== uid)) return `No repo ${repoId}.`;
        const builds = await store.listBuilds(repo.id);
        const b = builds[0];
        return `${repo.owner}/${repo.repo} · ${repo.status}${repo.appUrl ? ` · ${repo.appUrl}` : ""}${b ? ` · latest build ${b.status}` : ""}. Open /repos/${repo.id}`;
      }
      const repos = await store.listRepos(uid);
      if (repos.length === 0) return "No connected repos. Connect one on /repos.";
      return repos.map((r) => `${r.owner}/${r.repo} · ${r.status}`).join("\n");
    }
    default:
      return `Unknown tool ${tool}.`;
  }
}

export interface ChatAnswer {
  text: string;
  model: string;
  actions: string[];
  consent?: ConsentCard & { args: Record<string, unknown> };
}

/** Run one tool immediately (used after a human approves its consent card). */
export async function executeChatTool(tool: string, args: Record<string, unknown>, uid: string | undefined): Promise<string> {
  return executeTool(tool, args, uid);
}

/** Run one user message through the loop. Never throws (fails soft). */
export async function answerMessage(opts: {
  history: LoopTurn[];
  uid: string | undefined;
  extraNotes?: string[];
  surface?: string;
  model?: string;
  effort?: string;
}): Promise<ChatAnswer> {
  const actions: string[] = [];
  let model = "heuristic";
  try {
    const [tickets, schedules, repos, docs, meetRooms] = await Promise.all([
      store.listTickets(opts.uid).catch(() => []),
      store.listSchedules(opts.uid).catch(() => []),
      store.listRepos(opts.uid).catch(() => []),
      store.listContextDocs(opts.uid).catch(() => []),
      store.listMeetRooms(opts.uid).catch(() => []),
    ]);
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const roomsThisWeek = meetRooms.filter((r) => new Date(r.updatedAt).getTime() >= weekAgo);
    const assistedThisWeek = roomsThisWeek.filter(
      (r) => (r.transcript ?? []).some((l) => l.role === "agent"),
    ).length;
    const snapshot = {
      ...(opts.surface ? { surface: opts.surface } : {}),
      tickets: tickets.slice(0, 10).map((t) => ({ id: t.id, subject: t.subject, status: t.status })),
      schedules: schedules.map((s) => `${s.kind}/${s.preset}/${s.enabled ? "on" : "off"}`),
      repos: repos.map((r) => `${r.owner}/${r.repo}:${r.status}`),
      health: {
        openTickets: tickets.filter((t) => !/closed|verified|done/i.test(t.status)).length,
        totalTickets: tickets.length,
        schedulesOn: schedules.filter((s) => s.enabled).length,
        reposConnected: repos.length,
      },
      meet: {
        callsThisWeek: roomsThisWeek.length,
        callsCharieAssistedThisWeek: assistedThisWeek,
        totalCalls: meetRooms.length,
      },
    };
    const contextNotes = [...docs.slice(0, 5).map((d) => `${d.title}: ${(d.body ?? d.url ?? "").slice(0, 500)}`), ...(opts.extraNotes ?? [])];
    const convo: LoopTurn[] = [...opts.history];
    const seenCalls = new Set<string>();
    const collected: ToolResultEntry[] = [];
    let repeatWarned = false;
    for (let i = 0; i < 5; i++) {
      const turn = await engineTurn(convo, snapshot, contextNotes, { model: opts.model, effort: opts.effort });
      if (!turn) {
        return collected.length > 0
          ? { text: summarizeToolResults(collected), model, actions }
          : { text: "The engine is unreachable right now. Try again in a bit.", model, actions };
      }
      model = turn.model ?? model;
      if (turn.kind === "text") return { text: turn.text ?? "Done.", model, actions };
      const args = turn.args && typeof turn.args === "object" ? (turn.args as Record<string, unknown>) : {};
      const toolName = turn.tool ?? "";
      // A repeated identical call adds nothing and once burned the whole
      // loop (help, help, help). Warn once, then stop and synthesize.
      if (isRepeatCall(seenCalls, toolName, args)) {
        if (repeatWarned) break;
        repeatWarned = true;
        convo.push({ role: "tool", content: `[system] You already ran ${toolName} with the same arguments and its result is above. Do not call it again. Answer the user now with a text reply using the results and snapshot you have.` });
        continue;
      }
      seenCalls.add(toolSignature(toolName, args));
      // Side-effect tools never run silently in chat: propose a consent
      // card and stop. The tool runs only after an Approve click, which
      // calls executeChatTool from the consent endpoint.
      if (turn.tool && needsConsent(turn.tool)) {
        const card = consentCard(turn.tool, args);
        return {
          text: `I can do that, but I will not run it without your say-so. ${card.title}: ${card.detail}. Approve the card below and I will run it.`,
          model, actions,
          consent: { ...card, args },
        };
      }
      actions.push([toolName, ...Object.values(args).map((v) => String(v).slice(0, 60))].join(" ").slice(0, 160));
      convo.push({ role: "assistant", content: `Called tool ${toolName}.` });
      try {
        const result = await executeTool(toolName, args, opts.uid);
        collected.push({ tool: toolName, result: result.slice(0, 3000) });
        convo.push({ role: "tool", content: `[${toolName}] ${result.slice(0, 3000)}` });
      } catch (e) {
        convo.push({ role: "tool", content: `[${toolName}] error: ${(e as Error).message.slice(0, 200)}` });
      }
    }
    // One final chance for the model to write the answer, then a
    // deterministic synthesis from what was actually collected. The user
    // never sees a step-count dead end again.
    const last = await engineTurn(convo, snapshot, [...contextNotes, "FINAL ANSWER REQUIRED: reply with a text answer now, no tool call. Use the tool results and the snapshot (health and meet counts included). If a number was never provided, say you do not have it instead of guessing."], { model: opts.model, effort: opts.effort }).catch(() => null);
    if (last?.kind === "text" && last.text) return { text: last.text, model: last.model ?? model, actions };
    return { text: summarizeToolResults(collected), model, actions };
  } catch (e) {
    return { text: `Chat failed: ${(e as Error).message.slice(0, 200)}`, model, actions };
  }
}
