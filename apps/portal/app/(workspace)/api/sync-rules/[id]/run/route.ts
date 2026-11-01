import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { pullRule } from "@/lib/jira-sync";
import { identity, scopeUid } from "@/lib/who";

export const maxDuration = 300;

// POST /api/sync-rules/[id]/run - pull now (session authed).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await store.getSyncRule(id);
  if (!r) return NextResponse.json({ error: "no such rule" }, { status: 404 });
  if ((await identity(req)) === null) return NextResponse.json({ error: "login required" }, { status: 401 });
  const mine = scopeUid(await identity(req));
  if (mine && r.uid && r.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  return NextResponse.json({ id, status: await pullRule(id) });
}
