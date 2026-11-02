import { NextResponse } from "next/server";
import { runSweep } from "@/lib/guardian";
import { pushToAll } from "@/lib/push";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/who";

export async function POST(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const sweep = await runSweep();
  if (!sweep) return NextResponse.json({ error: "engine unreachable or targets unconfigured" }, { status: 502 });
  if (!sweep.pass) {
    await pushToAll("Guardian sweep failing", sweep.checks.filter((c) => !c.pass).map((c) => c.name).join(", "), "/guardian");
  }
  return NextResponse.json(sweep);
}
