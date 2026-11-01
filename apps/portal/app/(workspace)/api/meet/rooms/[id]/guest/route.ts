import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { store } from "@/lib/store";

// Guest check-in: public, invite-token gated. Files a support ticket from the
// stated issue so the team (and the agent) has context when the guest joins.
// Nothing about the guest is stored beyond name + issue on the ticket.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { token?: string; name?: string; issue?: string; consent?: boolean };
  if (!checkInvite(roomId, b.token)) return NextResponse.json({ error: "bad invite" }, { status: 403 });
  const name = String(b.name ?? "").trim().slice(0, 60);
  const issue = String(b.issue ?? "").trim().slice(0, 2000);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!issue) return NextResponse.json({ error: "issue required" }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "consent required" }, { status: 400 });
  const ticket = await store.createTicket({
    subject: `[Support call] ${issue.slice(0, 80)}`,
    body: `Guest ${name} joined "${room.title}" about: ${issue}`,
    goal: `Reproduce and diagnose: ${issue.slice(0, 200)}`,
    targetUrl: "",
    sourceRepo: `meet:${roomId}`,
  });
  await store.addMessage(ticket.roomId!, {
    authorType: "agent",
    authorName: "Charie",
    body: `Support call starting in "${room.title}" with guest ${name}. Press "Run investigation" once they share their screen or URL.`,
  });
  // Record the consented check-in: the signal route requires it before a
  // token guest may join or speak in the call.
  await store.saveMeetCheckin({ roomId, name, ticketId: ticket.id, at: new Date().toISOString() });
  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
