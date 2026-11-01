import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docs = await store.listContextDocs();
  const d = docs.find((x) => x.id === id);
  if (!d) return NextResponse.json({ error: "no such doc" }, { status: 404 });
  const mine = scopeUid(await identity(req));
  if (mine && d.uid && d.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  await store.deleteContextDoc(id);
  return NextResponse.json({ ok: true });
}
