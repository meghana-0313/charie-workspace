import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  return NextResponse.json({ docs: await store.listContextDocs(scopeUid(await identity(req))) });
}

export async function POST(req: Request) {
  const { title, source, body, url } = (await req.json().catch(() => ({}))) as {
    title?: string; source?: string; body?: string; url?: string;
  };
  const cleanTitle = String(title ?? "").trim().slice(0, 80);
  if (!cleanTitle) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (source !== "note" && source !== "url") return NextResponse.json({ error: "source must be note or url" }, { status: 400 });
  if (source === "note" && !String(body ?? "").trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (source === "url") {
    try {
      const u = new URL(String(url ?? "").trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad");
    } catch {
      return NextResponse.json({ error: "valid http(s) url required" }, { status: 400 });
    }
  }
  const at = new Date().toISOString();
  const d = {
    id: uid("ctx"), uid: scopeUid(await identity(req)), title: cleanTitle,
    source: source as "note" | "url",
    body: source === "note" ? String(body).trim().slice(0, 2000) : undefined,
    url: source === "url" ? String(url).trim() : undefined,
    createdAt: at, updatedAt: at,
  };
  await store.saveContextDoc(d);
  return NextResponse.json(d, { status: 201 });
}
