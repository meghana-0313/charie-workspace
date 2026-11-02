// Chat attachments: images, videos, voice notes, and files uploaded from the
// composer. Stored as blobs under uploads/ and read back through the session
// gated /api/uploads route. 25MB cap, same as voice tickets.
import { NextResponse } from "next/server";
import { saveVoiceNote } from "@/lib/blob";
import { uid } from "@/lib/store";
import { identity } from "@/lib/who";
import type { ChatAttachment } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;

function kindOf(name: string, type: string): ChatAttachment["kind"] {
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) return "image";
  if (type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(name)) return "video";
  if (type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(name)) return "audio";
  return "file";
}

export async function POST(req: Request) {
  if (!(await identity(req))) return NextResponse.json({ error: "login required" }, { status: 401 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "attachment over 25MB" }, { status: 400 });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "attachment";
  const key = `uploads/${uid("att")}-${safe}`;
  await saveVoiceNote(key, Buffer.from(await file.arrayBuffer()));
  const out: ChatAttachment = {
    name: file.name.slice(0, 120),
    url: `/api/uploads/${key.slice("uploads/".length)}`,
    path: key,
    kind: kindOf(file.name, file.type),
  };
  return NextResponse.json(out, { status: 201 });
}
