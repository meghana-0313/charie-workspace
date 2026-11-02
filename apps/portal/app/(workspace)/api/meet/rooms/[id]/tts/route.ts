import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { store } from "@/lib/store";
import { identity } from "@/lib/who";
import { speakableText } from "@/lib/room-status";

// Charie's human voice: proxy one short line to the Modal-hosted Kokoro
// TTS (CHARIE_TTS_URL, user Modal credits). Fails soft with 503 so the
// client falls back to the browser voice - she is never silent.
export const maxDuration = 60;

async function allowed(req: Request, roomId: string): Promise<boolean> {
  if (await identity(req)) return true;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return checkInvite(roomId, token);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if (!(await allowed(req, roomId))) return NextResponse.json({ error: "login or invite required" }, { status: 401 });
  const url = process.env.CHARIE_TTS_URL;
  if (!url) return NextResponse.json({ error: "voice not configured" }, { status: 503 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const clean = speakableText(String(text ?? ""));
  if (!clean) return NextResponse.json({ error: "text required" }, { status: 400 });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.CHARIE_TTS_MODAL_KEY && process.env.CHARIE_TTS_MODAL_SECRET) {
    headers["Modal-Key"] = process.env.CHARIE_TTS_MODAL_KEY;
    headers["Modal-Secret"] = process.env.CHARIE_TTS_MODAL_SECRET;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: clean }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return NextResponse.json({ error: `voice upstream ${res.status}` }, { status: 503 });
    const audio = await res.arrayBuffer();
    return new NextResponse(audio, { headers: { "content-type": res.headers.get("content-type") ?? "audio/wav", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "voice unreachable" }, { status: 503 });
  }
}
