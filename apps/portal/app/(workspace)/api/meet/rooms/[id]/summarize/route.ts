import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { store } from "@/lib/store";
import { actionNotes, getLive, setSummary } from "@/lib/livecall";
import { identity } from "@/lib/who";

// Spark summary of the live transcript (members + invited guests).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const authed = (await identity(req)) !== null || checkInvite(roomId, new URL(req.url).searchParams.get("token"));
  if (!authed) return NextResponse.json({ error: "login or invite required" }, { status: 401 });
  const { lines } = getLive(roomId);
  if (lines.length === 0) return NextResponse.json({ error: "no transcript yet" }, { status: 400 });
  const transcript = lines.map((l) => `${l.speaker} (${l.role}): ${l.text}`).join("\n").slice(0, 6000);
  const fallback = actionNotes(roomId).join("\n") || "No action items yet.";
  let summary = fallback;
  let model = "heuristic";
  try {
    const base = (process.env.ENGINE_URL ?? "http://localhost:3103").replace(/\/$/, "");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.ENGINE_TOKEN) headers["x-engine-token"] = process.env.ENGINE_TOKEN;
    const res = await fetch(`${base}/chat/turn`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        history: [{ role: "user", content: `Summarize this support-call transcript in 5 short bullets: what broke, what was tried, decisions, action items with owners. Transcript:\n${transcript}` }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) {
      const j = (await res.json()) as { kind?: string; text?: string; model?: string };
      if (j.kind === "text" && j.text) {
        summary = j.text;
        model = j.model ?? "spark";
      }
    }
  } catch {
    /* heuristic fallback stands */
  }
  setSummary(roomId, summary);
  return NextResponse.json({ summary, model });
}
