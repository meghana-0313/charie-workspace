// Delete Charie's memory of this room (members only, room owner):
// wipes the ephemeral transcript, notes, summary, thoughts, and action
// state; stops live capture; and leaves an audit tombstone on the linked
// support ticket (room id, who, when — never content). Export first.
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { clearRoom } from "@/lib/livecall";
import { displayName, identity, scopeUid } from "@/lib/who";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const me = await identity(req);
  if (!me) return NextResponse.json({ error: "login required" }, { status: 401 });
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const mine = scopeUid(me);
  if (room.uid && mine && room.uid !== mine) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  clearRoom(roomId);
  await store.updateMeetRoom(roomId, { liveNotes: false });
  const tickets = await store.listTickets(mine).catch(() => []);
  const ticket = tickets.find((t) => t.sourceRepo === `meet:${roomId}`) ?? null;
  if (ticket?.roomId) {
    const who = (await displayName(req)) || me.email;
    await store.addMessage(ticket.roomId, {
      authorType: "agent",
      authorName: "Charie",
      body: `Charie's memory of call room "${room.title}" (${roomId}) was deleted by ${who} at ${new Date().toISOString()}. Transcript, notes, and agent state were wiped; this tombstone is the only record kept.`,
    });
  }
  return NextResponse.json({ deleted: true, tombstoneTicket: ticket?.id ?? null });
}
