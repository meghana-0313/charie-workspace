import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";

// GET /api/uploads/<file...> — voice notes stored at ticket intake.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!path || path.length < 1) return new NextResponse("not found", { status: 404 });
  const base = join(process.cwd(), ".data", "uploads") + sep;
  const full = normalize(join(process.cwd(), ".data", "uploads", ...path));
  if (!full.startsWith(base) || !existsSync(full)) return new NextResponse("not found", { status: 404 });
  const ext = full.split(".").pop()?.toLowerCase();
  const type =
    ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" :
    ext === "m4a" ? "audio/mp4" : ext === "webm" ? "audio/webm" : "application/octet-stream";
  return new NextResponse(new Uint8Array(readFileSync(full)), { headers: { "content-type": type } });
}
