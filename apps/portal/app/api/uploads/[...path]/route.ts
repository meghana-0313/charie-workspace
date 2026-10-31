import { NextResponse } from "next/server";
import { readVoiceNote } from "@/lib/blob";

// GET /api/uploads/<file...> — voice notes stored at ticket intake.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!path || path.length < 1) return new NextResponse("not found", { status: 404 });
  const file = await readVoiceNote(path);
  if (!file) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), { headers: { "content-type": file.type } });
}
