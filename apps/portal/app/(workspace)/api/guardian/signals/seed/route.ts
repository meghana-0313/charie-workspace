import { NextResponse } from "next/server";
import { seedSignals } from "@/lib/guardian";

export const maxDuration = 300;

export async function POST() {
  const out = await seedSignals();
  if (!out) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  return NextResponse.json(out, { status: 201 });
}
