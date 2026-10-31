import { NextResponse } from "next/server";
import { readArtifact } from "@/lib/engine";

// GET /api/artifacts/<runId>/<file...> - screenshots, packets, traces.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!path || path.length < 2) return new NextResponse("not found", { status: 404 });
  const [runId, ...rel] = path;
  const file = await readArtifact(runId, rel);
  if (!file) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), { headers: { "content-type": file.type } });
}
