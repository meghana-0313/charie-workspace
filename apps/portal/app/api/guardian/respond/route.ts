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

// PUT /api/guardian/respond - verify containment, or roll back one action.
export async function PUT(req: Request) {
  const { incidentId, rollbackId } = (await req.json().catch(() => ({}))) as {
    incidentId?: string; rollbackId?: string;
  };
  if (!incidentId) return NextResponse.json({ error: "incidentId required" }, { status: 400 });
  const inc = await store.getIncident(incidentId);
  if (!inc) return NextResponse.json({ error: "unknown incident" }, { status: 404 });
  if (rollbackId) {
    if (!inc.actions.some((a) => a.id === rollbackId)) {
      return NextResponse.json({ error: "unknown action" }, { status: 404 });
    }
    const actions = inc.actions.map((a) => (a.id === rollbackId ? { ...a, status: "rolled-back" } : a));
    await store.updateIncident(incidentId, { actions, status: "open" });
    return NextResponse.json({ ok: true, rollbackId });
  }
  const events = await store.listRecentEvents(200);
  const out = await guardianVerify(inc.baselineSuspicious, events);
  if (!out) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  if (out.contained) await store.updateIncident(incidentId, { status: "contained" });
  return NextResponse.json(out);
}
