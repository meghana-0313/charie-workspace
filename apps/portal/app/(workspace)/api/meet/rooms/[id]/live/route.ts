import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { store } from "@/lib/store";
import { getLive, hydrateRoom, postLine } from "@/lib/livecall";
import { onLiveLine } from "@/lib/call-agent";
import { displayName, identity } from "@/lib/who";

// Live transcript relay (ephemeral memory, never stored). Members use their
// session, guests their invite token. Roles: session = teammate, token = customer.
async function caller(req: Request, roomId: string): Promise<{ role: "teammate" | "customer"; name: string } | null> {
  const id = await identity(req);
  if (id) return { role: "teammate", name: await displayName(req) };
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (checkInvite(roomId, token)) return { role: "customer", name: "" };
  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if ((await caller(req, roomId)) === null) return NextResponse.json({ error: "login or invite required" }, { status: 401 });
  if (room.liveNotes !== true) return NextResponse.json({ enabled: false, lines: [], notes: [], summary: "" });
  hydrateRoom(roomId, { transcript: room.transcript as never, summary: room.summary });
  return NextResponse.json({ enabled: true, ...getLive(roomId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if (room.liveNotes !== true) return NextResponse.json({ error: "live notes are off" }, { status: 400 });
  const who = await caller(req, roomId);
  if (!who) return NextResponse.json({ error: "login or invite required" }, { status: 401 });
  if (who.role === "customer") {
    // Transcription consent lives in the check-in record, not client state.
    const checkin = await store.lastMeetCheckin(roomId).catch(() => null);
    if (checkin?.transcribe !== true) {
      return NextResponse.json({ error: "transcription not consented" }, { status: 403 });
    }
  }
  const { text, name } = (await req.json().catch(() => ({}))) as { text?: string; name?: string };
  const clean = String(text ?? "").trim().slice(0, 500);
  if (!clean) return NextResponse.json({ error: "text required" }, { status: 400 });
  const speaker = who.role === "teammate" ? who.name : String(name ?? "").trim().slice(0, 60) || "Guest";
  hydrateRoom(roomId, { transcript: room.transcript as never, summary: room.summary });
  const line = postLine(roomId, { speaker, role: who.role, text: clean });
  // Charie listens along: may propose a consent card (never acts alone) and
  // now speaks a reply to questions. Awaited so the reply lands in the
  // transcript before the client's next poll; engine call is time-bounded.
  try { await onLiveLine(roomId, line); } catch { /* agent is best effort */ }
  return NextResponse.json(line, { status: 201 });
}
