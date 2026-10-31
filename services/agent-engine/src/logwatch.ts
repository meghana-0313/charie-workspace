// Log watch: live production monitoring for Google Cloud hosted apps.
// Polls Cloud Logging for recent errors/5xx, groups them into incidents,
// and feeds them into the signals pipeline. Auth comes from the runtime
// service account (metadata server); without GCP it reports unconfigured
// instead of pretending.

import type { FetchImpl } from "./baseten.js";

export interface LogIncident {
  signature: string;
  service: string;
  count: number;
  sample: string;
  firstSeen: string;
  lastSeen: string;
}

export interface LogWatchReport {
  id: string;
  at: string;
  projectId: string;
  windowMinutes: number;
  configured: boolean;
  total: number;
  groups: LogIncident[];
}

interface LogEntry {
  timestamp?: string;
  severity?: string;
  resource?: { labels?: Record<string, string> };
  httpRequest?: { status?: number; requestUrl?: string };
  textPayload?: string;
  jsonPayload?: { message?: string };
}

/** Access token from the metadata server. Null outside GCP. */
export async function metadataToken(fetchImpl: FetchImpl = fetch): Promise<string | null> {
  try {
    const res = await fetchImpl("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/** Pure grouping: signature = service + status/message head. */
export function groupEntries(entries: LogEntry[]): LogIncident[] {
  const map = new Map<string, LogIncident>();
  for (const e of entries) {
    const service = e.resource?.labels?.service_name ?? e.resource?.labels?.function_name ?? "unknown";
    const status = e.httpRequest?.status;
    const msg = (e.textPayload ?? e.jsonPayload?.message ?? "").replace(/\s+/g, " ").trim();
    const head = status && status >= 500 ? `http-${status}` : msg.slice(0, 80) || "empty-message";
    const signature = `${service} :: ${head}`;
    const ts = e.timestamp ?? new Date().toISOString();
    const cur = map.get(signature);
    if (cur) {
      cur.count++;
      if (ts < cur.firstSeen) cur.firstSeen = ts;
      if (ts > cur.lastSeen) cur.lastSeen = ts;
    } else {
      map.set(signature, { signature, service, count: 1, sample: msg.slice(0, 300), firstSeen: ts, lastSeen: ts });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 20);
}

/** Full run: query the last window of errors, group them. */
export async function runLogWatch(
  projectId: string,
  opts: { fetchImpl?: FetchImpl; windowMinutes?: number } = {},
): Promise<LogWatchReport> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const windowMinutes = opts.windowMinutes ?? 60;
  const base = { id: `lw_${Date.now().toString(36)}`, at: new Date().toISOString(), projectId, windowMinutes };
  const token = await metadataToken(fetchImpl);
  if (!token) {
    return { ...base, configured: false, total: 0, groups: [] };
  }
  const since = new Date(Date.now() - windowMinutes * 60000).toISOString();
  const res = await fetchImpl("https://logging.googleapis.com/v2/entries:list", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      resourceNames: [`projects/${projectId}`],
      filter: `timestamp>="${since}" severity>=ERROR`,
      orderBy: "timestamp desc",
      pageSize: 200,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "").then((t) => t.slice(0, 160));
    throw new Error(`logging query failed (${res.status}): ${detail || "check Logging Viewer role"}`);
  }
  const data = (await res.json()) as { entries?: LogEntry[] };
  const entries = data.entries ?? [];
  return { ...base, configured: true, total: entries.length, groups: groupEntries(entries) };
}
