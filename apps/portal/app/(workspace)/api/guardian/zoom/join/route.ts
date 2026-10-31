import { NextResponse } from "next/server";
import { zoomJoin } from "@/lib/guardian";

export async function POST(req: Request) {
  const { meetingUrl } = (await req.json().catch(() => ({}))) as { meetingUrl?: string };
  if (!meetingUrl) return NextResponse.json({ error: "meetingUrl required" }, { status: 400 });
  const out = await zoomJoin(meetingUrl);
  if (!out) return NextResponse.json({ error: "Recall.ai not configured or refused" }, { status: 501 });
  return NextResponse.json(out, { status: 201 });
}
