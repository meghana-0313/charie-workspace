import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  const threads = (await store.listThreads(scopeUid(await identity(req))))
    .map((t) => ({ ...t, messages: t.messages.slice(-1) }));
  return NextResponse.json({ threads });
}

export async function POST(req: Request) {
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const at = new Date().toISOString();
  const t = {
    id: uid("chat"),
    uid: scopeUid(await identity(req)),
    title: String(title ?? "").trim().slice(0, 80) || "New chat",
    messages: [],
    createdAt: at,
    updatedAt: at,
  };
  await store.saveThread(t);
  return NextResponse.json(t, { status: 201 });
}
