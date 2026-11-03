import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { store } from "@/lib/store";
import { identity } from "@/lib/who";
import { claimVisionSpeech, getAgent, recordVision, speak } from "@/lib/livecall";

// Charie watches a shared screen: one captured frame goes to the engine
// vision endpoint, the spoken description lands in the transcript as a
// Charie line (and is read aloud when voice is on). Browsers cannot give
// a web page remote control of a desktop, so Charie describes and guides;
// driving the product itself happens through Investigate (Playwright).
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
  if (!getAgent(roomId).enabled) return NextResponse.json({ error: "Bring Charie in first" }, { status: 400 });
  const { image, question, mode } = (await req.json().catch(() => ({}))) as { image?: string; question?: string; mode?: string };
  const img = String(image ?? "");
  if (!img.startsWith("data:image/") || img.length > 2_000_000) {
    return NextResponse.json({ error: "image frame required (max 2MB)" }, { status: 400 });
  }
  const base = (process.env.ENGINE_URL ?? "http://localhost:3103").replace(/\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ENGINE_TOKEN) headers["x-engine-token"] = process.env.ENGINE_TOKEN;
  try {
    const res = await fetch(`${base}/vision/describe`, {
      method: "POST",
      headers,
      body: JSON.stringify({ image: img, question: String(question ?? "What do you see on this screen?").slice(0, 300) }),
      signal: AbortSignal.timeout(45000),
    });
    const j = (await res.json().catch(() => ({}))) as { text?: string; model?: string; error?: string };
    if (!res.ok || !j.text) return NextResponse.json({ error: j.error ?? "vision unavailable" }, { status: 503 });
    recordVision(roomId, j.text, j.model);
    // Watch mode: remember silently; only speak up when the frame shows a
    // problem, so near-continuous watching never floods the transcript.
    const isProblem = /(error|fail|blocked|broken|crash|denied|invalid|warning|exception)/i.test(j.text);
    const shouldSpeak = mode !== "watch" || (isProblem && claimVisionSpeech(roomId, j.text));
    if (shouldSpeak) speak(roomId, j.text);
    return NextResponse.json({ text: j.text, model: j.model ?? "vision", spoke: shouldSpeak });
  } catch {
    return NextResponse.json({ error: "vision unreachable" }, { status: 503 });
  }
}
