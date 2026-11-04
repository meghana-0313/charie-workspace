import { NextResponse } from "next/server";
import { createWorkOrder, listWorkOrders } from "@/lib/guardian";
import type { WorkOrderStepView } from "@/lib/types";
import { identity, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  return NextResponse.json({ workorders: await listWorkOrders(scopeUid(await identity(req))) });
}

export async function POST(req: Request) {
  const { title, source, sourceRef, plan } = (await req.json().catch(() => ({}))) as {
    title?: string; source?: string; sourceRef?: string; plan?: WorkOrderStepView[];
  };
  if (!title?.trim() || !source || !sourceRef || !Array.isArray(plan) || plan.length === 0) {
    return NextResponse.json({ error: "title, source, sourceRef, plan[] required" }, { status: 400 });
  }
  const wo = await createWorkOrder({ title: title.trim(), source, sourceRef, plan }, scopeUid(await identity(req)));
  if (!wo) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  return NextResponse.json(wo, { status: 201 });
}
