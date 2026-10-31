import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { listMyRepos } from "@/lib/github";
import { identity } from "@/lib/who";

export async function GET(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  const tok = await store.getGithubToken(id.uid).catch(() => null);
  if (!tok) return NextResponse.json({ error: "github not connected" }, { status: 400 });
  const repos = await listMyRepos(tok.token);
  if (!repos) return NextResponse.json({ error: "github rejected the token" }, { status: 502 });
  return NextResponse.json({ repos });
}
