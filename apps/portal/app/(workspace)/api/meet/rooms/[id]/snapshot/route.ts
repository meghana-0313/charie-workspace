import { NextResponse } from "next/server";
import { identity } from "@/lib/who";
import { store } from "@/lib/store";
import { getLive } from "@/lib/livecall";

// Persist the current transcript, notes, and summary on the room WITHOUT
// ending it. Called when a member leaves, so re-opening the room later
// shows what happened instead of a fresh join screen.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const me = await identity(req);
  if (!me) return NextResponse.json({ error: "login required" }, { status: 401 });
  if (room.uid && room.uid !== me.uid) return NextResponse.json({ error: "not your room" }, { status: 403 });
  const live = getLive(roomId);
  if (live.lines.length > 0 || live.summary) {
    await store.updateMeetRoom(roomId, {
      transcript: live.lines.slice(-120),
      notes: live.notes,
      summary: live.summary || room.summary,
      screenLog: live.visionLog.slice(-180),
    });
  }
  return NextResponse.json({ ok: true, lines: live.lines.length });
}
