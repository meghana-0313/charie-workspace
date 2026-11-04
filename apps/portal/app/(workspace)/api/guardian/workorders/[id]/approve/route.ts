import { NextResponse } from "next/server";
import { approveWorkOrder } from "@/lib/guardian";
import { pushToAll } from "@/lib/push";
import { DEMO_USER, store } from "@/lib/store";
import { identity, isAdmin, scopeUid } from "@/lib/who";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { id } = await params;
  const wo = await approveWorkOrder(id, DEMO_USER, scopeUid(await identity(req)));
  if (!wo) return NextResponse.json({ error: "engine unreachable or bad transition" }, { status: 502 });
  await pushToAll("Work order approved", `${wo.title} is queued for Night Shift.`, `/guardian/work/${wo.id}`);
  return NextResponse.json(wo);
}
