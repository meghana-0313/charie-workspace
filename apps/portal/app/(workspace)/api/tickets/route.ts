import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { saveVoiceNote } from "@/lib/blob";
import { spawnEngineRun, transcribeNote, triageTicket } from "@/lib/engine";
import { extractGoal } from "@/lib/triage";
import { identity, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  return NextResponse.json(await store.listTickets(scopeUid(await identity(req))));
}

const MAX_VOICE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const fd = await req.formData();
  let subject = String(fd.get("subject") ?? "").trim();
  let body = String(fd.get("body") ?? "").trim();
  const goalInput = String(fd.get("goal") ?? "").trim();
  const targetUrl = String(fd.get("targetUrl") ?? "").trim();
  if (!targetUrl) {
    return NextResponse.json({ error: "targetUrl required" }, { status: 400 });
  }
  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "targetUrl must be a valid URL" }, { status: 400 });
  }

  let voiceNotePath: string | undefined;
  const voice = fd.get("voice");
  if (voice instanceof File && voice.size > 0) {
    if (voice.size > MAX_VOICE_BYTES) {
      return NextResponse.json({ error: "voice note over 25MB" }, { status: 400 });
    }
    const safe = voice.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    voiceNotePath = await saveVoiceNote(`uploads/${uid("voice")}-${safe}`, Buffer.from(await voice.arrayBuffer()));
  }

  // Voice-first flow: transcribe when the text fields are empty.
  if ((!subject || !body) && voiceNotePath) {
    const t = await transcribeNote(voiceNotePath);
    if (!t) {
      return NextResponse.json({ error: "transcription failed - fill subject and body manually" }, { status: 400 });
    }
    subject = subject || t.subject;
    body = body || t.body;
  }
  if (!subject || !body) {
    return NextResponse.json({ error: "subject and body required (or attach a voice note)" }, { status: 400 });
  }

  const goal = goalInput || (await triageTicket(subject, body))?.goal || extractGoal(subject, body);
  const ownerUid = scopeUid(await identity(req));

  const ticket = await store.createTicket({ subject, body, goal, targetUrl, voiceNotePath, uid: ownerUid });
  // Autopilot: start the investigation immediately when the engine answers.
  try {
    const runId = await spawnEngineRun({ targetUrl, goal, verify: false });
    await store.createRun({ id: runId, ticketId: ticket.id, roomId: ticket.roomId!, kind: "investigate", targetUrl, uid: ownerUid });
    await store.addRunToRoom(ticket.roomId!, runId);
    await store.setTicketStatus(ticket.id, "investigating");
    await store.addMessage(ticket.roomId!, {
      authorType: "agent",
      authorName: "Charie",
      body: `Room opened for "${subject}". Investigation started automatically - driving ${targetUrl} toward the goal.`,
    });
  } catch {
    await store.addMessage(ticket.roomId!, {
      authorType: "agent",
      authorName: "Charie",
      body: `Room opened for "${subject}". The engine is unreachable right now - press "Run investigation" once it is back.`,
    });
  }
  return NextResponse.json(ticket, { status: 201 });
}
