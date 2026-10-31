import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/who";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(store))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { id } = await params;
  await store.deleteSeat(id);
  return NextResponse.json({ ok: true });
}
