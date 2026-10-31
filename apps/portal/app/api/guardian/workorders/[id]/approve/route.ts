import { NextResponse } from "next/server";
import { approveWorkOrder } from "@/lib/guardian";
import { pushToAll } from "@/lib/push";
import { DEMO_USER } from "@/lib/store";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wo = await approveWorkOrder(id, DEMO_USER);
  if (!wo) return NextResponse.json({ error: "engine unreachable or bad transition" }, { status: 502 });
  await pushToAll("Work order approved", `${wo.title} is queued for Night Shift.`, `/guardian/work/${wo.id}`);
  return NextResponse.json(wo);
}
