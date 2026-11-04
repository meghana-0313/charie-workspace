import { NextResponse } from "next/server";
import { seedSignals } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";

export const maxDuration = 300;

export async function POST(req: Request) {
  const out = await seedSignals(scopeUid(await identity(req)));
  if (!out) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  return NextResponse.json(out, { status: 201 });
}
