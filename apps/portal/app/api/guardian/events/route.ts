import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import type { GuardEventView } from "@/lib/types";

function validEvent(e: unknown): e is GuardEventView {
  if (!e || typeof e !== "object") return false;
  const v = e as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.ts === "string" &&
    (v.kind === "auth" || v.kind === "api" || v.kind === "traffic" || v.kind === "infra")
  );
}

// POST /api/guardian/events {events[]} - ingest a batch (webhook shape).
export async function POST(req: Request) {
  const { events } = (await req.json().catch(() => ({}))) as { events?: unknown };
  if (!Array.isArray(events) || events.length === 0 || events.length > 500) {
    return NextResponse.json({ error: "events[] with 1-500 entries required" }, { status: 400 });
  }
  const clean: GuardEventView[] = [];
  for (const e of events) {
    if (validEvent(e)) clean.push(e);
    else if (e && typeof e === "object") {
      const v = e as Record<string, unknown>;
      clean.push({
        id: typeof v.id === "string" ? v.id : uid("gev"),
        ts: typeof v.ts === "string" ? v.ts : new Date().toISOString(),
        kind: "traffic",
        actor: typeof v.actor === "string" ? v.actor : undefined,
        ip: typeof v.ip === "string" ? v.ip : undefined,
        endpoint: typeof v.endpoint === "string" ? v.endpoint : undefined,
        outcome: v.outcome === "success" || v.outcome === "failure" || v.outcome === "deny" || v.outcome === "allow" ? v.outcome : undefined,
      });
    }
  }
  if (clean.length === 0) return NextResponse.json({ error: "no usable events" }, { status: 400 });
  await store.saveEvents(clean);
  return NextResponse.json({ saved: clean.length }, { status: 201 });
}

export async function GET() {
  return NextResponse.json(await store.listRecentEvents(50));
}
