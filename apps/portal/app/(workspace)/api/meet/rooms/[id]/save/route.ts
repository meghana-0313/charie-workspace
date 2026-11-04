import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { getLive } from "@/lib/livecall";
import { identity, scopeUid } from "@/lib/who";

// Save call notes (members only): appends the transcript + notes to the
// support ticket when the room has one, else saves a context doc.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  if ((await identity(req)) === null) return NextResponse.json({ error: "login required" }, { status: 401 });
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const { lines, notes, summary } = getLive(roomId);
  if (lines.length === 0) return NextResponse.json({ error: "no transcript yet" }, { status: 400 });
  const mine = scopeUid(await identity(req));
  const body = [
    `Call notes from "${room.title}" (${lines.length} lines).`,
    "",
    ...lines.map((l) => `${l.speaker} (${l.role}): ${l.text}`),
    "",
    "Action notes:",
    ...notes.map((n) => `- ${n}`),
    summary ? "" : "",
    ...(summary ? ["Summary:", summary] : []),
  ].join("\n").slice(0, 8000);
  const ticket = (await store.listTickets(mine)).find((t) => t.sourceRepo === `meet:${roomId}`);
  if (ticket?.roomId) {
    await store.addMessage(ticket.roomId, { authorType: "agent", authorName: "Charie", body });
    return NextResponse.json({ savedTo: "ticket", id: ticket.id });
  }
  const at = new Date().toISOString();
  const doc = {
    id: uid("ctx"), uid: mine, title: `Call notes: ${room.title}`.slice(0, 80),
    source: "note" as const, body, createdAt: at, updatedAt: at,
  };
  await store.saveContextDoc(doc);
  return NextResponse.json({ savedTo: "context", id: doc.id });
}
