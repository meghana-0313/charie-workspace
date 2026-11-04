import { NextResponse } from "next/server";
import { identity } from "@/lib/who";
import { store } from "@/lib/store";
import { hydrateRoom } from "@/lib/livecall";

// Re-open an ended room on the same issue. Host only. Clears endedAt so
// joins work again, and re-seeds the live memory from the persisted
// transcript, notes, and summary so Charie has the full prior context.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if (new URL(req.url).searchParams.get("token")) {
    return NextResponse.json({ error: "guests cannot reopen the meeting" }, { status: 403 });
  }
  const me = await identity(req);
  if (!me) return NextResponse.json({ error: "login required" }, { status: 401 });
  if (room.uid && room.uid !== me.uid) {
    return NextResponse.json({ error: "only the host can reopen this meeting" }, { status: 403 });
  }
  if (room.endedAt) {
    try {
      await store.updateMeetRoom(roomId, { endedAt: undefined });
    } catch {
      return NextResponse.json({ error: "Could not reopen this room. Try again." }, { status: 500 });
    }
    const after = await store.getMeetRoom(roomId).catch(() => null);
    if (after?.endedAt) {
      return NextResponse.json({ error: "This room is still marked ended. Try again." }, { status: 500 });
    }
    hydrateRoom(roomId, { transcript: room.transcript as never, summary: room.summary, screenLog: room.screenLog });
  }
  return NextResponse.json({ ok: true, status: "Open", contextLines: room.transcript?.length ?? 0 });
}
