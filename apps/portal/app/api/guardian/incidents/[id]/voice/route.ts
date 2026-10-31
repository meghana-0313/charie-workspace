import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { saveVoiceNote } from "@/lib/blob";
import { transcribeNote } from "@/lib/engine";

const MAX_VOICE_BYTES = 25 * 1024 * 1024;

// POST /api/guardian/incidents/[id]/voice - record/attach a voice brief,
// transcribe it via Muse Voice, pin the text to the incident.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inc = await store.getIncident(id);
  if (!inc) return NextResponse.json({ error: "unknown incident" }, { status: 404 });
  const fd = await req.formData();
  const voice = fd.get("voice");
  if (!(voice instanceof File) || voice.size === 0) {
    return NextResponse.json({ error: "voice file required" }, { status: 400 });
  }
  if (voice.size > MAX_VOICE_BYTES) {
    return NextResponse.json({ error: "voice note over 25MB" }, { status: 400 });
  }
  const safe = voice.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await saveVoiceNote(`uploads/${uid("voice")}-${safe}`, Buffer.from(await voice.arrayBuffer()));
  const t = await transcribeNote(blob);
  if (!t) return NextResponse.json({ error: "transcription failed" }, { status: 502 });
  const entry = `[${new Date().toISOString().slice(0, 16).replace("T", " ")}] ${t.subject} - ${t.body}`;
  await store.updateIncident(id, { voiceBrief: inc.voiceBrief ? `${inc.voiceBrief}\n${entry}` : entry });
  return NextResponse.json({ ok: true, entry }, { status: 201 });
}
