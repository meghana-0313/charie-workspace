import { NextResponse } from "next/server";
import { DEMO_USER, store } from "@/lib/store";

export async function POST(req: Request) {
  const { roomId, findingIds, instruction } = (await req.json().catch(() => ({}))) as {
    roomId?: string; findingIds?: string[]; instruction?: string;
  };
  if (!roomId || !Array.isArray(findingIds) || findingIds.length === 0 || !instruction?.trim()) {
    return NextResponse.json({ error: "roomId, findingIds[], instruction required" }, { status: 400 });
  }
  if (!store.getRoom(roomId)) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const approval = store.addApproval(roomId, { findingIds, instruction: instruction.trim(), approvedBy: DEMO_USER });
  const ticket = store.getRoom(roomId) && store.getTicket(store.getRoom(roomId)!.ticketId);
  if (ticket) store.setTicketStatus(ticket.id, "fix-proposed");
  store.addMessage(roomId, {
    authorType: "human",
    authorName: DEMO_USER,
    body: `Approved fix instruction for ${findingIds.join(", ")}: ${instruction.trim()}`,
    findingIds,
  });
  return NextResponse.json(approval, { status: 201 });
}
