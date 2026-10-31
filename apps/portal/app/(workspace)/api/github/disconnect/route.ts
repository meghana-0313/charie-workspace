import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity } from "@/lib/who";

export async function DELETE(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  await store.deleteGithubToken(id.uid).catch(() => {});
  return NextResponse.json({ ok: true });
}
