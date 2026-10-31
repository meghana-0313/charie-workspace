import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import type { GuardEventView } from "@/lib/types";

const MAX_LOG_BYTES = 2 * 1024 * 1024;
const KINDS = ["auth", "api", "traffic", "infra"] as const;
const OUTCOMES = ["success", "failure", "deny", "allow"] as const;

// POST /api/guardian/events/upload - ingest a JSON array or JSONL log file.
export async function POST(req: Request) {
  const fd = await req.formData();
  const file = fd.get("logs");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "logs file required" }, { status: 400 });
  }
  if (file.size > MAX_LOG_BYTES) {
    return NextResponse.json({ error: "log file over 2MB" }, { status: 400 });
  }
  const text = await file.text();
  let raw: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(text);
    raw = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    raw = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      try {
        return JSON.parse(l) as unknown;
      } catch {
        return null;
      }
    }).filter((x) => x !== null);
  }
  const events: GuardEventView[] = [];
  for (const r of raw.slice(0, 500)) {
    const o = r as Record<string, unknown>;
    if (!o || typeof o !== "object") continue;
    const kind = KINDS.includes(o.kind as (typeof KINDS)[number]) ? o.kind as GuardEventView["kind"] : "api";
    const outcome = OUTCOMES.includes(o.outcome as (typeof OUTCOMES)[number])
      ? o.outcome as GuardEventView["outcome"]
      : undefined;
    events.push({
      id: typeof o.id === "string" ? o.id : uid("evt"),
      ts: typeof o.ts === "string" ? o.ts : new Date().toISOString(),
      kind,
      actor: typeof o.actor === "string" ? o.actor : undefined,
      ip: typeof o.ip === "string" ? o.ip : undefined,
      endpoint: typeof o.endpoint === "string" ? o.endpoint : undefined,
      outcome,
      country: typeof o.country === "string" ? o.country : undefined,
      bytes: typeof o.bytes === "number" ? o.bytes : undefined,
      records: typeof o.records === "number" ? o.records : undefined,
    });
  }
  if (events.length === 0) return NextResponse.json({ error: "no parseable events in file" }, { status: 400 });
  // Firestore rejects undefined values - round-trip strips them.
  await store.saveEvents(JSON.parse(JSON.stringify(events)) as GuardEventView[]);
  return NextResponse.json({ saved: events.length }, { status: 201 });
}
