import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { jiraTest } from "@/lib/jira";
import { vendorTest, VENDOR_SECRET_KEYS, type VendorKind } from "@/lib/vendors";
import { identity, scopeUid } from "@/lib/who";
import type { Connector, ConnectorKind } from "@/lib/types";

const SECRET_KEYS = ["token", "apiToken", "serviceRoleKey", "clientSecret"] as const;

function sanitize(c: Connector): Omit<Connector, "config"> & { config: Record<string, string | undefined>; hasSecret: boolean } {
  const config: Record<string, string | undefined> = { ...c.config };
  let hasSecret = false;
  for (const k of SECRET_KEYS) {
    if (config[k]) hasSecret = true;
    delete config[k];
  }
  return { ...c, config, hasSecret };
}

export async function GET(req: Request) {
  const list = await store.listConnectors(scopeUid(await identity(req)));
  return NextResponse.json({ connectors: list.map(sanitize) });
}

const VENDOR_LABEL: Record<VendorKind, string> = { azure: "Azure", cloudflare: "Cloudflare", supabase: "Supabase" };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string | undefined>;
  const { kind, name } = body;
  if (kind !== "jira" && kind !== "webhook-in" && kind !== "azure" && kind !== "cloudflare" && kind !== "supabase") {
    return NextResponse.json({ error: "kind must be jira, webhook-in, azure, cloudflare, or supabase (GitHub connects on /repos)" }, { status: 400 });
  }
  const at = new Date().toISOString();
  const owner = scopeUid(await identity(req));
  if (kind === "webhook-in") {
    const c: Connector = {
      id: uid("conn"), uid: owner, kind, name: String(name ?? "").trim().slice(0, 60) || "Webhook",
      status: "connected", config: {}, createdAt: at, updatedAt: at,
    };
    await store.saveConnector(c);
    return NextResponse.json(sanitize(c), { status: 201 });
  }
  if (kind === "jira") {
    const d = String(body.domain ?? "").trim();
    const e = String(body.email ?? "").trim();
    const t = String(body.token ?? "").trim();
    if (!d || !e || !t) return NextResponse.json({ error: "domain, email, and API token required" }, { status: 400 });
    const who = await jiraTest({ domain: d, email: e, token: t });
    if (!who) return NextResponse.json({ error: "Jira rejected these credentials" }, { status: 400 });
    const c: Connector = {
      id: uid("conn"), uid: owner, kind: "jira", name: String(name ?? "").trim().slice(0, 60) || "Jira",
      status: "connected", detail: `signed in as ${who}`,
      config: { domain: d, email: e, token: t }, createdAt: at, updatedAt: at,
    };
    await store.saveConnector(c);
    return NextResponse.json(sanitize(c), { status: 201 });
  }
  // Vendor connectors (Azure / Cloudflare / Supabase): test before save,
  // exactly like Jira. Sync jobs are a follow-up; connect + verify is live.
  const vendor = kind as VendorKind;
  const config: Connector["config"] = vendor === "cloudflare"
    ? { apiToken: String(body.apiToken ?? "").trim() }
    : vendor === "supabase"
      ? { projectRef: String(body.projectRef ?? "").trim(), serviceRoleKey: String(body.serviceRoleKey ?? "").trim() }
      : {
          tenantId: String(body.tenantId ?? "").trim(),
          clientId: String(body.clientId ?? "").trim(),
          clientSecret: String(body.clientSecret ?? "").trim(),
          subscriptionId: String(body.subscriptionId ?? "").trim() || undefined,
        };
  if (VENDOR_SECRET_KEYS[vendor].some((k) => !String(config[k as keyof Connector["config"]] ?? "").trim())
    || (vendor === "supabase" && !config.projectRef)
    || (vendor === "azure" && (!config.tenantId || !config.clientId))) {
    return NextResponse.json({ error: `all ${VENDOR_LABEL[vendor]} credential fields are required` }, { status: 400 });
  }
  const who = await vendorTest(vendor, config as Record<string, string | undefined>);
  if (!who) return NextResponse.json({ error: `${VENDOR_LABEL[vendor]} rejected these credentials` }, { status: 400 });
  const c: Connector = {
    id: uid("conn"), uid: owner, kind: vendor as ConnectorKind,
    name: String(name ?? "").trim().slice(0, 60) || VENDOR_LABEL[vendor],
    status: "connected", detail: who, config, createdAt: at, updatedAt: at,
  };
  await store.saveConnector(c);
  return NextResponse.json(sanitize(c), { status: 201 });
}
