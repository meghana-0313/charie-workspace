import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { connectRepo } from "@/lib/repos";

export async function GET() {
  return NextResponse.json({ repos: await store.listRepos() });
}

export async function POST(req: Request) {
  const { url, token, subdir, startCommand } = (await req.json().catch(() => ({}))) as {
    url?: string; token?: string; subdir?: string; startCommand?: string;
  };
  if (!url?.trim()) return NextResponse.json({ error: "url required" }, { status: 400 });
  try {
    const repo = await connectRepo({ url: url.trim(), token: token?.trim() || undefined, subdir, startCommand });
    const { token: _t, ...safe } = repo;
    return NextResponse.json(safe, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
