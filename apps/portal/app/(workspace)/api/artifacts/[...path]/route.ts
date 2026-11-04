import { NextResponse } from "next/server";
import { readArtifact } from "@/lib/engine";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";

// GET /api/artifacts/<runId>/<file...> - screenshots, packets, traces.
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!path || path.length < 2) return new NextResponse("not found", { status: 404 });
  const [runId, ...rel] = path;
  const me = await identity(req);
  if (!me) return new NextResponse("login required", { status: 401 });
  const rec = await store.getRun(runId).catch(() => null);
  const scope = scopeUid(me);
  if (rec && scope && rec.uid && rec.uid !== scope) return new NextResponse("not found", { status: 404 });
  const file = await readArtifact(runId, rel);
  if (!file) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), { headers: { "content-type": file.type } });
}
