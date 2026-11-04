// Charie call agent: the in-call brain for Meet war rooms.
//
// When the host enables Charie, she listens to the (consented) transcript,
// narrates what she is thinking into a side panel everyone can see, speaks
// short updates into the transcript, and proposes actions as consent cards.
// Nothing with side effects runs until a human approves the card:
// investigate (real engine run), share-screen (asks a participant to show
// the failing app), workorder (Guardian fix task), summarize.

import { store } from "./store";
import { createWorkOrder } from "./guardian";
import { fileTicketAndInvestigate } from "./tickets";
import { readFindings, runStatus } from "./engine";
import {
  addAction, addThought, getAgent, getLive, setAgentEnabled, speak, updateAction,
  type AgentAction, type LiveLine,
} from "./livecall";
import { charieShouldReply, clampCallReply, isScreenHistoryQuestion, isScreenSeeQuestion, screenHistoryReply, screenQuestionTime, screenVisionReply, shortVisionConfirm } from "./room-status";
import { getVision, getVisionLog } from "./livecall";
import { answerMessage } from "./charie-chat";

/**
 * Reply through the exact same loop as Chat with Charie (answerMessage):
 * same engine turns, same tool execution, same model. One difference only:
 * the reply is kept short enough to speak aloud. Returns null when the
 * engine is unreachable, so the caller can fall back honestly.
 */
async function engineReply(roomId: string, line: LiveLine): Promise<string | null> {
  const { lines } = getLive(roomId);
  const history = lines.slice(-6).map((l) => ({
    role: l.role === "agent" ? "assistant" as const : "user" as const,
    content: `${l.speaker}: ${l.text}`,
  }));
  const vision = getVision(roomId);
  // Ground-truth anchoring: a captured frame description already in this
  // history is the one source of truth about the screen. The model used
  // to both describe a frame and later deny seeing it; now the frame is
  // restated as an instruction it cannot contradict, and causes the
  // frame cannot show must be named as unknowable, not guessed.
  const screenNote = vision
    ? `Screen ground truth: at ${vision.at} you captured and described this frame: "${vision.text}". It is in this history as your own line. For anything about the screen, use ONLY this: never deny seeing it, never contradict it, never repeat the full description unless asked. If asked WHY something in it happened (for example why usage spiked), say the frame shows the fact but cannot show the cause, and offer the next place to check. If the frame shows an action that failed with no visible error (a checkout with no confirmation, a button that did nothing), do not guess: ask them to press F12, open the Network tab, and repeat the action once, then look again - the failed request and its status (for example POST /api/checkout 500) will be readable in your next captured frame, and you can name it exactly.`
    : "Screen truth: no frame has been captured in this call yet. Do not claim to see any screen; ask them to share and press Charie, look.";
  try {
    const ans = await answerMessage({
      history, uid: undefined, surface: "meet-call", effort: "low",
      extraNotes: ["You are speaking aloud in a live video call as Charie. Answer ONLY what was just asked - nothing extra, no side observations, no advice they did not request. Be brief like a human in a meeting: ONE short sentence, at most 25 words, unless they explicitly ask for detail. A yes/no question gets a yes/no first. Lead with the answer - no preamble, no restating their question, no filler like 'great question'. If a short answer would mislead, say the key point and offer to expand. Plain words, contractions. No markdown, no lists, no links, no ticket ids or URLs read aloud.", screenNote],
    });
    if (!ans.text || ans.model === "heuristic" && /engine is unreachable/i.test(ans.text)) return null;
    return clampCallReply(ans.text) || null;
  } catch {
    return null;
  }
}

const BUG_RE = /(bug|error|fail|broken|crash|not working|doesn.?t work|issue|checkout|payment|500|timeout)/i;

export function enableAgent(roomId: string, roomTitle: string) {
  const a = setAgentEnabled(roomId, true);
  if (!a.thoughts.length) {
    addThought(roomId, `Charie joined "${roomTitle}" and is listening. I only act after someone approves a card.`);
    speak(roomId, "Hi, I'm Charie. I'm listening in and will flag anything I can debug. I won't run anything without your approval.");
  }
  return a;
}

export function disableAgent(roomId: string) {
  setAgentEnabled(roomId, false);
  addThought(roomId, "Charie left the call. Transcript and notes remain until someone deletes my memory.");
  return getAgent(roomId);
}

/** React to a fresh transcript line. Called from the live relay. */
export async function onLiveLine(roomId: string, line: LiveLine) {
  const a = getAgent(roomId);
  if (!a.enabled || line.role === "agent") return;
  if (BUG_RE.test(line.text) && !a.proposedInvestigate) {
    a.proposedInvestigate = true;
    addThought(roomId, `Heard a likely failure from ${line.speaker}: "${line.text.slice(0, 120)}". Proposing a live investigation.`);
    addAction(roomId, {
      kind: "investigate",
      title: "Investigate this live",
      detail: "Charie drives the product like a first-time user, collects screenshots and repro steps, and reports findings here.",
    });
    speak(roomId, "That sounds like a real failure. I can investigate it live if you approve the card on the right.");
    return;
  }
  // Speak back: Charie answers any participant (teammate or customer) who
  // asks a question or addresses her by name. Engine text when reachable,
  // an honest heuristic acknowledgement otherwise - never silent.
  if (isScreenHistoryQuestion(line.text)) {
    const log = getVisionLog(roomId);
    addThought(roomId, `Screen-history question from ${line.speaker}: answering from ${log.length} recorded frame(s), not a model guess.`);
    speak(roomId, screenHistoryReply(log, screenQuestionTime(line.text), new Date().toISOString()));
    return;
  }
  if (isScreenSeeQuestion(line.text)) {
    // A frame description spoken seconds ago already answered this -
    // never follow it with a contradictory "I can't see" line.
    const lastAgentLine = [...getLive(roomId).lines].reverse().find((l) => l.role === "agent");
    if (lastAgentLine && /^I see\b/i.test(lastAgentLine.text) && Date.now() - new Date(lastAgentLine.at).getTime() < 15000) {
      addThought(roomId, "Screen question already answered by the frame description just spoken; not repeating or contradicting it.");
      return;
    }
    const vision = getVision(roomId);
    addThought(roomId, vision ? `Screen question from ${line.speaker}: answering from the last captured frame (${vision.at}).` : `Screen question from ${line.speaker}: no frame captured yet, saying so honestly.`);
    // If she JUST described this frame aloud (Look/watch), do not re-read
    // it verbatim - a short confirmation is what a human would say.
    const lastAgent = [...getLive(roomId).lines].reverse().find((l) => l.role === "agent");
    const justDescribed = Boolean(vision && lastAgent && (
      lastAgent.text.includes(vision.text.slice(0, 50)) || vision.text.includes(lastAgent.text.slice(0, 50))
    ) && Date.now() - new Date(lastAgent!.at).getTime() < 180000);
    speak(roomId, justDescribed && vision ? shortVisionConfirm(vision.text) : screenVisionReply(vision?.text ?? null, vision?.at ?? null, new Date().toISOString()));
    return;
  }
  if (charieShouldReply(line.text)) {
    addThought(roomId, `Replying to ${line.speaker}: "${line.text.slice(0, 120)}"`);
    const reply = await engineReply(roomId, line);
    if (reply) {
      speak(roomId, reply);
    } else {
      speak(roomId, "I could not reach my brain just then. Ask me again in a moment.");
      addThought(roomId, "Engine unreachable, so that reply was heuristic (analysisSource: heuristic), not a model answer.");
    }
  }
}

async function linkedTicket(roomId: string, ownerUid?: string) {
  const tickets = await store.listTickets(ownerUid).catch(() => []);
  return tickets.find((t) => t.sourceRepo === `meet:${roomId}`) ?? null;
}

async function execute(roomId: string, action: AgentAction, room: { title: string; uid?: string }): Promise<AgentAction> {
  const ownerUid = room.uid;
  if (action.kind === "investigate") {
    const ticket = await linkedTicket(roomId, ownerUid);
    const settingTarget = await store.getSetting("defaultTargetUrl").catch(() => null);
    const targetUrl = ticket?.targetUrl || settingTarget || "";
    if (!targetUrl) {
      addThought(roomId, "No product URL yet. Set a default product URL in Settings, or file the ticket with the app URL, then ask me again.");
      speak(roomId, "I need the product URL to investigate. Add it in Settings and I'll start right away.");
      return updateAction(roomId, action.id, { status: "failed", result: "No product URL configured" })!;
    }
    const { lines } = getLive(roomId);
    const excerpt = lines.slice(-12).map((l) => `${l.speaker} (${l.role}): ${l.text}`).join("\n");
    addThought(roomId, `Approval received. Starting investigation of ${targetUrl} with the call transcript as context.`);
    const { ticket: t, runId } = await fileTicketAndInvestigate({
      subject: `[War room] ${room.title}`.slice(0, 140),
      body: `Live war-room investigation requested during "${room.title}".\n\nRecent transcript:\n${excerpt}`.slice(0, 2000),
      targetUrl,
      ownerUid,
      // Tag the ticket as on-call: the Tickets page gives these their own
      // section, and linkedTicket() finds the ticket again by this tag.
      sourceRepo: `meet:${roomId}`,
    });
    const a = getAgent(roomId);
    a.runId = runId ?? undefined;
    a.runAnnounced = false;
    speak(roomId, runId ? "Investigation started. I'm driving the app now and will report findings here." : "The engine is unreachable, so I filed the ticket for a manual run.");
    return updateAction(roomId, action.id, { status: "done", result: `/tickets/${t.id}` })!;
  }
  if (action.kind === "share-screen") {
    addThought(roomId, "Screen share approved. Waiting for the participant to show the failing app; I'll narrate what I see in the notes.");
    speak(roomId, "Thanks. Please share the tab with the failing app. I'll watch for the error and take notes.");
    return updateAction(roomId, action.id, { status: "done", result: "Share requested" })!;
  }
  if (action.kind === "workorder") {
    const { notes } = getLive(roomId);
    const wo = await createWorkOrder({
      title: `Fix from war room: ${room.title}`.slice(0, 140),
      source: "manual",
      sourceRef: roomId,
      plan: [
        { kind: "re-analyze", label: "Reproduce the issue discussed on the call", ref: roomId },
        { kind: "evidence-pack", label: `Assemble call evidence (${notes.length} notes)`, ref: roomId },
        { kind: "docs-note", label: "Draft remediation note from proofs", ref: roomId },
      ],
    }, ownerUid).catch(() => null);
    if (!wo) return updateAction(roomId, action.id, { status: "failed", result: "Engine unreachable" })!;
    addThought(roomId, `Fix task created: ${wo.id}. It waits in Fix Tasks for approval before anything runs.`);
    speak(roomId, "Fix task created. It's waiting in Fix Tasks for a human to approve and run.");
    return updateAction(roomId, action.id, { status: "done", result: `/guardian/work/${wo.id}` })!;
  }
  // summarize: the client calls the existing summarize endpoint next.
  addThought(roomId, "Summary approved. Generating the call summary now.");
  return updateAction(roomId, action.id, { status: "done", result: "Summary requested" })!;
}

export async function decideAction(roomId: string, actionId: string, decision: "approved" | "denied", room: { title: string; uid?: string }) {
  const a = getAgent(roomId);
  const action = a.actions.find((x) => x.id === actionId);
  if (!action || action.status !== "pending") return action ?? null;
  if (decision === "denied") {
    addThought(roomId, `"${action.title}" was declined. I won't do that.`);
    return updateAction(roomId, actionId, { status: "denied" });
  }
  updateAction(roomId, actionId, { status: "approved" });
  try {
    return await execute(roomId, action, room);
  } catch (e) {
    addThought(roomId, `"${action.title}" failed: ${(e as Error).message.slice(0, 120)}`);
    return updateAction(roomId, actionId, { status: "failed", result: "Execution failed" });
  }
}

export function proposeAction(roomId: string, kind: AgentAction["kind"]) {
  const templates: Record<AgentAction["kind"], { title: string; detail: string }> = {
    investigate: { title: "Investigate this live", detail: "Drive the product, collect evidence, and report findings here." },
    "share-screen": { title: "Ask a participant to share their screen", detail: "Charie watches the failing app live and narrates what she sees. The participant chooses what to share." },
    workorder: { title: "Create a fix task from this call", detail: "Turns the call notes into a Guardian fix task that still needs human approval to run." },
    summarize: { title: "Summarize the call now", detail: "Charie writes the summary with speaker roles and action items." },
  };
  addThought(roomId, `Proposing: ${templates[kind].title}. Waiting for a human decision.`);
  return addAction(roomId, { kind, ...templates[kind] });
}

/** Lazy run watcher: when someone polls agent state, announce completion once. */
export async function refreshRunState(roomId: string) {
  const a = getAgent(roomId);
  if (!a.enabled || !a.runId || a.runAnnounced) return;
  const status = await runStatus(a.runId).catch(() => "running");
  if (status === "done") {
    const findings = await readFindings(a.runId).catch(() => null);
    a.runAnnounced = true;
    addThought(roomId, `Investigation finished: ${findings?.length ?? 0} finding(s). Evidence is on the ticket.`);
    speak(roomId, `Investigation finished with ${findings?.length ?? 0} findings. The evidence is on the ticket for review.`);
  } else if (status === "failed") {
    a.runAnnounced = true;
    addThought(roomId, "The investigation run failed. The ticket keeps the transcript context for a manual retry.");
  }
}
