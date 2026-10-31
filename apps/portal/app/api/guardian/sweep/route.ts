import { NextResponse } from "next/server";
import { runSweep } from "@/lib/guardian";
import { pushToAll } from "@/lib/push";

export async function POST() {
  const sweep = await runSweep();
  if (!sweep) return NextResponse.json({ error: "engine unreachable or targets unconfigured" }, { status: 502 });
  if (!sweep.pass) {
    await pushToAll("Guardian sweep failing", sweep.checks.filter((c) => !c.pass).map((c) => c.name).join(", "), "/guardian");
  }
  return NextResponse.json(sweep);
}
