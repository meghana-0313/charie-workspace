// Vendor credential tests for Azure, Cloudflare, and Supabase connectors.
// Same contract as jiraTest: return a human label on success, null on any
// failure. Credentials are only used for the identity check at connect time
// and stored server-side on the Connector (never serialized to clients).

export interface CloudflareCreds { apiToken: string }
export interface SupabaseCreds { projectRef: string; serviceRoleKey: string }
export interface AzureCreds { tenantId: string; clientId: string; clientSecret: string; subscriptionId?: string }

const TIMEOUT = 20000;

export async function cloudflareTest(c: CloudflareCreds): Promise<string | null> {
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { authorization: `Bearer ${c.apiToken}`, accept: "application/json", "user-agent": "charie-portal" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { success?: boolean; result?: { status?: string } };
    return j.success ? `token ${j.result?.status ?? "active"}` : null;
  } catch {
    return null;
  }
}

export async function supabaseTest(c: SupabaseCreds): Promise<string | null> {
  const ref = c.projectRef.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\.supabase\.co.*$/, "");
  if (!ref) return null;
  try {
    const res = await fetch(`https://${ref}.supabase.co/auth/v1/health`, {
      headers: { apikey: c.serviceRoleKey, authorization: `Bearer ${c.serviceRoleKey}`, "user-agent": "charie-portal" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    return `project ${ref} healthy`;
  } catch {
    return null;
  }
}

export async function azureTest(c: AzureCreds): Promise<string | null> {
  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "charie-portal" },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        grant_type: "client_credentials",
        scope: "https://management.azure.com/.default",
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!tokenRes.ok) return null;
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) return null;
    const res = await fetch("https://management.azure.com/subscriptions?api-version=2022-12-01", {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json", "user-agent": "charie-portal" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { value?: Array<{ displayName?: string; subscriptionId?: string }> };
    const sub = c.subscriptionId
      ? j.value?.find((s) => s.subscriptionId === c.subscriptionId)
      : j.value?.[0];
    return sub ? `${sub.displayName ?? "subscription"} (${sub.subscriptionId})` : "token ok, no subscriptions visible";
  } catch {
    return null;
  }
}

export type VendorKind = "azure" | "cloudflare" | "supabase";

export async function vendorTest(kind: VendorKind, config: Record<string, string | undefined>): Promise<string | null> {
  if (kind === "cloudflare") return config.apiToken ? cloudflareTest({ apiToken: config.apiToken }) : null;
  if (kind === "supabase") {
    return config.projectRef && config.serviceRoleKey
      ? supabaseTest({ projectRef: config.projectRef, serviceRoleKey: config.serviceRoleKey })
      : null;
  }
  return config.tenantId && config.clientId && config.clientSecret
    ? azureTest({ tenantId: config.tenantId, clientId: config.clientId, clientSecret: config.clientSecret, subscriptionId: config.subscriptionId })
    : null;
}

/** Secret config keys per vendor kind: stripped before any client response. */
export const VENDOR_SECRET_KEYS: Record<VendorKind, string[]> = {
  cloudflare: ["apiToken"],
  supabase: ["serviceRoleKey"],
  azure: ["clientSecret"],
};
