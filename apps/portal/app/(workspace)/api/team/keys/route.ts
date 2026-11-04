import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { mintApiKey } from "@/lib/keys";
import { identity, isAdmin, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const keys = (await store.listApiKeys(scopeUid(await identity(req)))).map(({ hash, salt, ...rest }) => rest);
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!String(name ?? "").trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const { record, secret } = await mintApiKey(String(name).trim(), scopeUid(await identity(req)));
  return NextResponse.json({ id: record.id, prefix: record.prefix, name: record.name, secret }, { status: 201 });
}
