// Shared ticket filing: create the ticket + room, then auto-investigate
// when the engine answers. Used by the tickets API, chat, and Jira sync.
import { store } from "./store";
import { spawnEngineRun, triageTicket } from "./engine";
import { extractGoal } from "./triage";
import type { Ticket } from "./types";

export interface FileTicketInput {
  subject: string;
  body: string;
  goal?: string;
  targetUrl: string;
  voiceNotePath?: string;
  sourceRepo?: string;
  ownerUid?: string;
}

export async function fileTicketAndInvestigate(input: FileTicketInput): Promise<{ ticket: Ticket; runId: string | null }> {
  const goal = input.goal || (await triageTicket(input.subject, input.body).catch(() => null))?.goal || extractGoal(input.subject, input.body);
  const ticket = await store.createTicket({
    subject: input.subject,
    body: input.body,
    goal,
    targetUrl: input.targetUrl,
    voiceNotePath: input.voiceNotePath,
    sourceRepo: input.sourceRepo,
    uid: input.ownerUid,
  });
  try {
    const runId = await spawnEngineRun({ targetUrl: input.targetUrl, goal, verify: false });
    await store.createRun({
      id: runId, ticketId: ticket.id, roomId: ticket.roomId!,
      kind: "investigate", targetUrl: input.targetUrl, uid: input.ownerUid,
    });
    await store.addRunToRoom(ticket.roomId!, runId);
    await store.setTicketStatus(ticket.id, "investigating");
    await store.addMessage(ticket.roomId!, {
      authorType: "agent",
      authorName: "Charie",
      body: `Room opened for "${input.subject}". Investigation started automatically - driving ${input.targetUrl} toward the goal.`,
    });
    return { ticket, runId };
  } catch {
    await store.addMessage(ticket.roomId!, {
      authorType: "agent",
      authorName: "Charie",
      body: `Room opened for "${input.subject}". The engine is unreachable right now - press "Run investigation" once it is back.`,
    });
    return { ticket, runId: null };
  }
}
