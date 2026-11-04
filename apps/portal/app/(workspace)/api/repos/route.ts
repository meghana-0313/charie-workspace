import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { connectRepo } from "@/lib/repos";
import { identity, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  return NextResponse.json({ repos: await store.listRepos(scopeUid(await identity(req))) });
}

export async function POST(req: Request) {
  const { url, token, subdir, startCommand, branch } = (await req.json().catch(() => ({}))) as {
    url?: string; token?: string; subdir?: string; startCommand?: string; branch?: string;
  };
  if (!url?.trim()) return NextResponse.json({ error: "url required" }, { status: 400 });
  try {
    const id = await identity(req);
    let stored = token?.trim() || undefined;
    if (!stored && id?.uid) {
      stored = (await store.getGithubToken(id.uid).catch(() => null))?.token;
    }
    const repo = await connectRepo({
      url: url.trim(), token: stored, subdir, startCommand, branch, uid: scopeUid(id),
    });
    const { token: _t, webhookSecret: _w, ...safe } = repo;
    return NextResponse.json({ ...safe, webhook: Boolean(repo.webhookSecret) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
