import { NextResponse } from "next/server";
import { scheduleWorkOrder } from "@/lib/guardian";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wo = await scheduleWorkOrder(id);
  if (!wo) return NextResponse.json({ error: "engine unreachable or bad transition" }, { status: 502 });
  return NextResponse.json(wo);
}
