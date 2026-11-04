import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { displayName, identity, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  const id = await identity(req);
  // Never list unscoped: without an identity there is no room list at all.
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  return NextResponse.json({ rooms: await store.listMeetRooms(scopeUid(id)) });
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
