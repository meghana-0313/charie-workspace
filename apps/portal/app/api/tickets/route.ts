import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { store, uid } from "@/lib/store";

export async function GET() {
  return NextResponse.json(store.listTickets());
}

const MAX_VOICE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const fd = await req.formData();
  const subject = String(fd.get("subject") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const goal = String(fd.get("goal") ?? "").trim();
  const targetUrl = String(fd.get("targetUrl") ?? "").trim();
  if (!subject || !body || !goal || !targetUrl) {
    return NextResponse.json({ error: "subject, body, goal, targetUrl required" }, { status: 400 });
  }
  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "targetUrl must be a valid URL" }, { status: 400 });
  }

  let voiceNotePath: string | undefined;
  const voice = fd.get("voice");
  if (voice instanceof File && voice.size > 0) {
    if (voice.size > MAX_VOICE_BYTES) {
      return NextResponse.json({ error: "voice note over 25MB" }, { status: 400 });
    }
    const dir = join(process.cwd(), ".data", "uploads");
    mkdirSync(dir, { recursive: true });
    const safe = voice.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    voiceNotePath = `uploads/${uid("voice")}-${safe}`;
    writeFileSync(join(process.cwd(), ".data", voiceNotePath), Buffer.from(await voice.arrayBuffer()));
  }

  const ticket = store.createTicket({ subject, body, goal, targetUrl, voiceNotePath });
  store.addMessage(ticket.roomId!, {
    authorType: "agent",
    authorName: "GhostQA",
    body: `Room opened for “${subject}”. Press “Run investigation” to drive ${targetUrl} toward the goal.`,
  });
  return NextResponse.json(ticket, { status: 201 });
}
