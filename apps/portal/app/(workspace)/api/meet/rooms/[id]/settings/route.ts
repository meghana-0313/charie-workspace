import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { clearRoom } from "@/lib/livecall";
import { identity } from "@/lib/who";

// Room settings (members only). Turning live notes off wipes call memory.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  if ((await identity(req)) === null) return NextResponse.json({ error: "login required" }, { status: 401 });
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const { liveNotes } = (await req.json().catch(() => ({}))) as { liveNotes?: boolean };
  if (typeof liveNotes !== "boolean") return NextResponse.json({ error: "liveNotes boolean required" }, { status: 400 });
  await store.updateMeetRoom(roomId, { liveNotes });
  if (!liveNotes) clearRoom(roomId);
  return NextResponse.json({ liveNotes });
}
