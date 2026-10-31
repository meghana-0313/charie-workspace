import { NextResponse } from "next/server";
import { tickAutopilot } from "@/lib/autopilot";
import { identity } from "@/lib/who";

export const maxDuration = 300;

// Session-authed tick for the Autopilot page (local runs, manual "run due").
export async function POST(req: Request) {
  if ((await identity(req)) === null) return NextResponse.json({ error: "login required" }, { status: 401 });
  return NextResponse.json(await tickAutopilot());
}
