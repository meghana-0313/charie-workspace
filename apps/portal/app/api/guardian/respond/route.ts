import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { guardianRespond, guardianVerify } from "@/lib/engine";

// POST /api/guardian/respond {incidentId, action, target} - simulated action.
export async function POST(req: Request) {
  const { incidentId, action, target } = (await req.json().catch(() => ({}))) as {
    incidentId?: string; action?: string; target?: string;
  };
  if (!incidentId || (action !== "block_ip" && action !== "revoke_sessions" && action !== "rate_limit") || !target) {
    return NextResponse.json({ error: "incidentId, action, target required" }, { status: 400 });
  }
  const inc = await store.getIncident(incidentId);
  if (!inc) return NextResponse.json({ error: "unknown incident" }, { status: 404 });
  const done = await guardianRespond(action, target);
  if (!done) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  await store.updateIncident(incidentId, { actions: [...inc.actions, done] });
  return NextResponse.json(done, { status: 201 });
}

// POST /api/guardian/verify {incidentId} - check the fresh window vs baseline.
export async function PUT(req: Request) {
  const { incidentId } = (await req.json().catch(() => ({}))) as { incidentId?: string };
  if (!incidentId) return NextResponse.json({ error: "incidentId required" }, { status: 400 });
  const inc = await store.getIncident(incidentId);
  if (!inc) return NextResponse.json({ error: "unknown incident" }, { status: 404 });
  const events = await store.listRecentEvents(200);
  const out = await guardianVerify(inc.baselineSuspicious, events);
  if (!out) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  if (out.contained) await store.updateIncident(incidentId, { status: "contained" });
  return NextResponse.json(out);
}
