import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { jiraTest } from "@/lib/jira";
import { identity, scopeUid } from "@/lib/who";
import type { Connector } from "@/lib/types";

function sanitize(c: Connector): Omit<Connector, "config"> & { config: { domain?: string; email?: string }; hasSecret: boolean } {
  const { token: _t, ...rest } = c.config;
  return { ...c, config: rest, hasSecret: Boolean(_t) };
}

export async function GET(req: Request) {
  const list = await store.listConnectors(scopeUid(await identity(req)));
  return NextResponse.json({ connectors: list.map(sanitize) });
}

export async function POST(req: Request) {
  const { kind, name, domain, email, token } = (await req.json().catch(() => ({}))) as {
    kind?: string; name?: string; domain?: string; email?: string; token?: string;
  };
  if (kind !== "jira" && kind !== "webhook-in") {
    return NextResponse.json({ error: "kind must be jira or webhook-in (GitHub connects on /repos)" }, { status: 400 });
  }
  const cleanName = String(name ?? "").trim().slice(0, 60) || (kind === "jira" ? "Jira" : "Webhook");
  const at = new Date().toISOString();
  if (kind === "webhook-in") {
    const c: Connector = {
      id: uid("conn"), uid: scopeUid(await identity(req)), kind, name: cleanName,
      status: "connected", config: {}, createdAt: at, updatedAt: at,
    };
    await store.saveConnector(c);
    return NextResponse.json(sanitize(c), { status: 201 });
  }
  const d = String(domain ?? "").trim();
  const e = String(email ?? "").trim();
  const t = String(token ?? "").trim();
  if (!d || !e || !t) return NextResponse.json({ error: "domain, email, and API token required" }, { status: 400 });
  const who = await jiraTest({ domain: d, email: e, token: t });
  if (!who) return NextResponse.json({ error: "Jira rejected these credentials" }, { status: 400 });
  const c: Connector = {
    id: uid("conn"), uid: scopeUid(await identity(req)), kind: "jira", name: cleanName,
    status: "connected", detail: `signed in as ${who}`,
    config: { domain: d, email: e, token: t }, createdAt: at, updatedAt: at,
  };
  await store.saveConnector(c);
  return NextResponse.json(sanitize(c), { status: 201 });
}
