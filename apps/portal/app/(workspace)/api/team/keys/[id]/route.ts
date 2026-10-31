import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/who";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { id } = await params;
  const keys = await store.listApiKeys();
  const key = keys.find((k) => k.id === id);
  if (!key) return NextResponse.json({ error: "no such key" }, { status: 404 });
  await store.saveApiKey({ ...key, revoked: true });
  return NextResponse.json({ ok: true });
}
