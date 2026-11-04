import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { jiraTest } from "@/lib/jira";
import { vendorTest, type VendorKind } from "@/lib/vendors";
import { identity, scopeUid } from "@/lib/who";

// POST /api/connectors/[id]/test - re-verify credentials, update status.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await store.getConnector(id);
  if (!c) return NextResponse.json({ error: "no such connector" }, { status: 404 });
  const mine = scopeUid(await identity(req));
  if (mine && c.uid && c.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  let who: string | null = null;
  if (c.kind === "jira") {
    if (!c.config.domain || !c.config.email || !c.config.token) {
      return NextResponse.json({ error: "nothing to test" }, { status: 400 });
    }
    who = await jiraTest({ domain: c.config.domain, email: c.config.email, token: c.config.token });
  } else if (c.kind === "azure" || c.kind === "cloudflare" || c.kind === "supabase") {
    const hasAny = Object.values(c.config).some((v) => String(v ?? "").trim());
    if (!hasAny) return NextResponse.json({ error: "nothing to test" }, { status: 400 });
    who = await vendorTest(c.kind as VendorKind, c.config as Record<string, string | undefined>);
  } else {
    return NextResponse.json({ error: "nothing to test" }, { status: 400 });
  }
  const at = new Date().toISOString();
  await store.saveConnector({
    ...c,
    status: who ? "connected" : "error",
    detail: who ?? "credentials rejected",
    updatedAt: at,
  });
  return NextResponse.json({ ok: Boolean(who), detail: who ?? "rejected" });
}
