import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { displayName } from "@/lib/who";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  if (!(await store.getRoom(roomId))) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  if (!body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  const msg = await store.addMessage(roomId, { authorType: "human", authorName: await displayName(req), body: body.trim() });
  return NextResponse.json(msg, { status: 201 });
}
