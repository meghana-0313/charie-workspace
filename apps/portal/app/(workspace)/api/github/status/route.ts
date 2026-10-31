import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity } from "@/lib/who";

export async function GET(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  const tok = await store.getGithubToken(id.uid).catch(() => null);
  return NextResponse.json({
    configured: Boolean(process.env.GITHUB_OAUTH_CLIENT_ID),
    connected: Boolean(tok),
    login: tok?.login ?? null,
  });
}
