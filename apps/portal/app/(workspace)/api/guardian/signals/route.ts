import { NextResponse } from "next/server";
import { ingestSignals } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages } = (await req.json().catch(() => ({}))) as {
    messages?: Array<{ channel?: string; author?: string; text?: string }>;
  };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    return NextResponse.json({ error: "messages[1..100] required" }, { status: 400 });
  }
  const clean = messages.filter((m) => m.text?.trim()).map((m) => ({ channel: m.channel, author: m.author, text: m.text!.trim() }));
  if (clean.length === 0) return NextResponse.json({ error: "no message text" }, { status: 400 });
  const out = await ingestSignals(clean, scopeUid(await identity(req)));
  if (!out) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  return NextResponse.json(out, { status: 201 });
}
