import { NextResponse } from "next/server";
import { identity } from "@/lib/who";
import { store } from "@/lib/store";
import { getLive } from "@/lib/livecall";

// End the meeting for everyone. Host only: the signed-in member who owns the
// room. Sets endedAt (joins then get 410) and broadcasts an "end" signal so
// every connected client, guests included, leaves immediately.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if (new URL(req.url).searchParams.get("token")) {
    return NextResponse.json({ error: "guests cannot end the meeting" }, { status: 403 });
  }
  const me = await identity(req);
  if (!me) return NextResponse.json({ error: "login required" }, { status: 401 });
  if (room.uid && room.uid !== me.uid) {
    return NextResponse.json({ error: "only the host can end this meeting" }, { status: 403 });
  }
  if (!room.endedAt) {
    // Persist transcript, notes, and summary on the room itself so it can be
    // re-opened later on the same issue with full context (also survives a
    // portal restart, unlike the ephemeral live memory).
    const live = getLive(roomId);
    await store.updateMeetRoom(roomId, {
      endedAt: new Date().toISOString(),
      transcript: live.lines.length > 0 ? live.lines.slice(-120) : room.transcript,
      notes: live.notes.length > 0 ? live.notes : room.notes,
      summary: live.summary || room.summary || undefined,
      screenLog: live.visionLog.length > 0 ? live.visionLog.slice(-180) : room.screenLog,
    });
    await store.postMeetSignal(roomId, { from: "host", to: "*", kind: "end", payload: "" }).catch(() => null);
  }
  return NextResponse.json({ ok: true, endedAt: room.endedAt ?? new Date().toISOString() });
}
