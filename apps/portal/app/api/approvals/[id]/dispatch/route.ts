import { NextResponse } from "next/server";
import { DEMO_USER, store } from "@/lib/store";

// POST /api/approvals/[id]/dispatch - hand the approved instruction to the
// coding agent: flip status, log the handoff in the room, return the command.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { roomId } = (await req.json().catch(() => ({}))) as { roomId?: string };
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
  const room = await store.getRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const approval = await store.setApprovalStatus(roomId, id, "sent-to-agent");
  if (!approval) return NextResponse.json({ error: "no such approval" }, { status: 404 });
  const runId = room.runIds.at(-1) ?? "";
  const packets = approval.findingIds.map((f) => `/api/artifacts/${runId}/mcp-packets/${f}.md`);
  await store.addMessage(roomId, {
    authorType: "human",
    authorName: DEMO_USER,
    body: `Dispatched to coding agent: ${approval.findingIds.join(", ")}. Packets: ${packets.join(", ")}`,
    findingIds: approval.findingIds,
  });
  return NextResponse.json({
    approval,
    packets,
    command: `charie apply ${approval.id}`,
  });
}
