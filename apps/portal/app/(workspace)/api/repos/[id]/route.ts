import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await identity(req);
  if (!me) return NextResponse.json({ error: "login required" }, { status: 401 });
  const { id } = await params;
  const repo = await store.getRepo(id);
  if (!repo) return NextResponse.json({ error: "unknown repo" }, { status: 404 });
  const scope = scopeUid(me);
  if (scope && repo.uid && repo.uid !== scope) return NextResponse.json({ error: "not your repo" }, { status: 403 });
  if (repo.status === "building") {
    return NextResponse.json({ error: "build in flight - wait for it to finish" }, { status: 409 });
  }
  await store.deleteRepo(id);
  return NextResponse.json({ ok: true });
}
