import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await store.getConnector(id);
  if (!c) return NextResponse.json({ error: "no such connector" }, { status: 404 });
  const mine = scopeUid(await identity(req));
  if (mine && c.uid && c.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  for (const r of (await store.listSyncRules()).filter((x) => x.connectorId === id)) {
    await store.deleteSyncRule(r.id);
  }
  await store.deleteConnector(id);
  return NextResponse.json({ ok: true });
}
