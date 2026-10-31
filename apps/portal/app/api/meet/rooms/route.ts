import { NextResponse } from "next/server";
import { DEMO_USER, store } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ rooms: await store.listMeetRooms() });
}

export async function POST(req: Request) {
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  const room = await store.createMeetRoom({ title: title.trim().slice(0, 120), createdBy: DEMO_USER });
  return NextResponse.json(room, { status: 201 });
}
