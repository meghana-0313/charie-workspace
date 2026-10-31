import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await store.getRepo(id);
  if (!repo) return NextResponse.json({ error: "unknown repo" }, { status: 404 });
  if (repo.status === "building") {
    return NextResponse.json({ error: "build in flight - wait for it to finish" }, { status: 409 });
  }
  await store.deleteRepo(id);
  return NextResponse.json({ ok: true });
}
