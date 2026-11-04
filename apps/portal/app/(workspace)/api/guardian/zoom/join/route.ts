import { NextResponse } from "next/server";
import { zoomJoin } from "@/lib/guardian";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/who";

export async function POST(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { meetingUrl } = (await req.json().catch(() => ({}))) as { meetingUrl?: string };
  if (!meetingUrl) return NextResponse.json({ error: "meetingUrl required" }, { status: 400 });
  const out = await zoomJoin(meetingUrl);
  if (!out) return NextResponse.json({ error: "Recall.ai not configured or refused" }, { status: 501 });
  return NextResponse.json(out, { status: 201 });
}
