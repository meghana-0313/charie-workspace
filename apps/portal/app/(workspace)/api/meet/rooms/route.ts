import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { displayName, identity, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  return NextResponse.json({ rooms: await store.listMeetRooms(scopeUid(await identity(req))) });
}

export async function POST(req: Request) {
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  const id = await identity(req);
  const room = await store.createMeetRoom({
    title: title.trim().slice(0, 120),
    createdBy: await displayName(req),
    uid: scopeUid(id),
  });
  return NextResponse.json(room, { status: 201 });
}
