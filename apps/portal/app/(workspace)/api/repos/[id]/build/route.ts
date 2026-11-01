import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { startBuild } from "@/lib/repos";
import { identity, scopeUid } from "@/lib/who";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await identity(req);
  if (!me) return NextResponse.json({ error: "login required" }, { status: 401 });
  const { id } = await params;
  const repo = await store.getRepo(id);
  if (!repo) return NextResponse.json({ error: "unknown repo" }, { status: 404 });
  const scope = scopeUid(me);
  if (scope && repo.uid && repo.uid !== scope) return NextResponse.json({ error: "not your repo" }, { status: 403 });
  try {
    const build = await startBuild(id);
    return NextResponse.json(build, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
