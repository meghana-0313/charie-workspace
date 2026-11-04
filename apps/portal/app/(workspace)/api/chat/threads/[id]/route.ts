import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await store.getThread(id);
  if (!t) return NextResponse.json({ error: "no such thread" }, { status: 404 });
  const mine = scopeUid(await identity(req));
  if (mine && t.uid && t.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  return NextResponse.json(t);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await store.getThread(id);
  if (!t) return NextResponse.json({ error: "no such thread" }, { status: 404 });
  const mine = scopeUid(await identity(req));
  if (mine && t.uid && t.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  await store.deleteThread(id);
  return NextResponse.json({ ok: true });
}
