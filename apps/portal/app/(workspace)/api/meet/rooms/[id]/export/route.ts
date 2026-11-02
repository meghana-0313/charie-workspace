// Export call data (members only): everything Charie holds for this room,
// as a JSON download the team keeps before deleting her memory.
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getAgent, getLive } from "@/lib/livecall";
import { identity, scopeUid } from "@/lib/who";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const me = await identity(req);
  if (!me) return NextResponse.json({ error: "login required" }, { status: 401 });
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const mine = scopeUid(me);
  if (room.uid && mine && room.uid !== mine) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { lines, notes, summary } = getLive(roomId);
  const agent = getAgent(roomId);
  const checkin = await store.lastMeetCheckin(roomId).catch(() => null);
  const tickets = await store.listTickets(mine).catch(() => []);
  const ticket = tickets.find((t) => t.sourceRepo === `meet:${roomId}`) ?? null;
  const payload = {
    room: { id: room.id, title: room.title, createdAt: room.createdAt },
    exportedAt: new Date().toISOString(),
    exportedBy: me.email,
    guest: checkin ? { name: checkin.name, checkedInAt: checkin.at, ticketId: checkin.ticketId } : null,
    supportTicketId: ticket?.id ?? null,
    transcript: lines,
    actionNotes: notes,
    summary,
    charie: { thoughts: agent.thoughts, actions: agent.actions },
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="charie-call-${roomId}.json"`,
    },
  });
}
