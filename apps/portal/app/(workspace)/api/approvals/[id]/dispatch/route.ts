import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { displayName } from "@/lib/who";

// POST /api/approvals/[id]/dispatch - hand the approved instruction to the
// coding agent: flip status, log the handoff in the room, return a real
// agent prompt plus absolute evidence-packet URLs.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { roomId } = (await req.json().catch(() => ({}))) as { roomId?: string };
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });
  const room = await store.getRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const approval = await store.setApprovalStatus(roomId, id, "sent-to-agent");
  if (!approval) return NextResponse.json({ error: "no such approval" }, { status: 404 });
  const runId = room.runIds.at(-1) ?? "";
  const base = (process.env.PORTAL_PUBLIC_URL ?? "").replace(/\/$/, "");
  const packets = approval.findingIds.map((f) => `${base}/api/artifacts/${runId}/mcp-packets/${f}.md`);
  const ticketUrl = `${base}/tickets/${room.ticketId}`;
  const prompt = [
    "You are fixing issues found by Charie (autonomous QA).",
    `Ticket room: ${ticketUrl}`,
    `Run: ${runId}`,
    "",
    "Instruction from the team:",
    approval.instruction,
    "",
    "Evidence packets (repro steps, screenshots, suspected cause):",
    ...packets.map((p) => `- ${p}`),
    "",
    "Fix each finding, keep behavior otherwise identical, then reply with the",
    "files changed and how to verify. The team presses Verify fix in Charie.",
  ].join("\n");
  await store.addMessage(roomId, {
    authorType: "human",
    authorName: await displayName(req),
    body: `Dispatched to coding agent: ${approval.findingIds.join(", ")}.`,
    findingIds: approval.findingIds,
  });
  return NextResponse.json({ approval, packets, prompt });
}
