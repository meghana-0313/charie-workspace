import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { guardianAnalyze } from "@/lib/engine";
import { pushToAll } from "@/lib/push";
import { identity, isAdmin, scopeUid } from "@/lib/who";
import type { Incident } from "@/lib/types";

// POST /api/guardian/analyze - run the recent window through detection + AI.
export async function POST(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const me = await identity(req);
  const events = await store.listRecentEvents(200, scopeUid(me));
  if (events.length === 0) {
    return NextResponse.json({ error: "no events yet - simulate an attack or ingest some first" }, { status: 400 });
  }
  const out = await guardianAnalyze(events);
  if (!out) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  if (out.signals.length === 0) return NextResponse.json({ incident: null, mode: "clear" });
  const rank = { blocker: 0, major: 1, minor: 2 } as const;
  const top = [...out.signals].sort(
    (a, b) => (rank[a.severity as keyof typeof rank] ?? 2) - (rank[b.severity as keyof typeof rank] ?? 2),
  )[0];
  const now = new Date().toISOString();
  const incident: Incident = {
    id: uid("inc"),
    uid: scopeUid(me),
    title: top.title,
    severity: top.severity as Incident["severity"],
    status: "open",
    signals: out.signals,
    investigation: out.investigation,
    mode: out.investigation ? "investigated" : "signals-only",
    baselineSuspicious: events.filter((e) => e.outcome === "failure" || e.outcome === "deny").length,
    actions: [],
    simulated: true,
    createdAt: now,
    updatedAt: now,
  };
  await store.saveIncident(incident);
  await pushToAll(`Guardian: ${incident.severity} incident`, incident.title, `/guardian/${incident.id}`);
  return NextResponse.json({ incident, mode: incident.mode }, { status: 201 });
}
