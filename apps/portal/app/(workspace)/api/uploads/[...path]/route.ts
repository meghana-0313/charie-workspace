import { NextResponse } from "next/server";
import { readVoiceNote } from "@/lib/blob";
import { identity } from "@/lib/who";

// GET /api/uploads/<file...> - voice notes stored at ticket intake.
// Blob names carry a random id; a signed-in identity is still required here
// so the guarantee does not rest on the edge gate alone.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await identity(req))) return new NextResponse("login required", { status: 401 });
  const { path } = await params;
  if (!path || path.length < 1) return new NextResponse("not found", { status: 404 });
  const file = await readVoiceNote(path);
  if (!file) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), { headers: { "content-type": file.type } });
}
