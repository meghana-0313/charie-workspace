import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { jiraTest } from "@/lib/jira";
import { identity, scopeUid } from "@/lib/who";

// POST /api/connectors/[id]/test - re-verify credentials, update status.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await store.getConnector(id);
  if (!c) return NextResponse.json({ error: "no such connector" }, { status: 404 });
  const mine = scopeUid(await identity(req));
  if (mine && c.uid && c.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  if (c.kind !== "jira" || !c.config.domain || !c.config.email || !c.config.token) {
    return NextResponse.json({ error: "nothing to test" }, { status: 400 });
  }
  const who = await jiraTest({ domain: c.config.domain, email: c.config.email, token: c.config.token });
  const at = new Date().toISOString();
  await store.saveConnector({
    ...c,
    status: who ? "connected" : "error",
    detail: who ? `signed in as ${who}` : "credentials rejected",
    updatedAt: at,
  });
  return NextResponse.json({ ok: Boolean(who), detail: who ? `signed in as ${who}` : "rejected" });
}
