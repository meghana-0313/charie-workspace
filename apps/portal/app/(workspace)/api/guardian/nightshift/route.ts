import { NextResponse } from "next/server";
import { runNightShift } from "@/lib/guardian";
import { pushToAll } from "@/lib/push";
import { store } from "@/lib/store";
import { isAdmin } from "@/lib/who";

// POST /api/guardian/nightshift - run the shift now (same path the
// scheduler hits overnight), then push the digest to subscribers.
export const maxDuration = 600;

export async function POST(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { orderIds } = (await req.json().catch(() => ({}))) as { orderIds?: string[] };
  const report = await runNightShift(orderIds);
  if (!report) return NextResponse.json({ error: "engine unreachable or shift already running" }, { status: 502 });
  const done = report.orders.filter((o) => o.status === "done").length;
  await pushToAll(
    "Night Shift digest ready",
    `${done}/${report.orders.length} orders done. Security re-scan grade ${report.pentest?.grade ?? "unknown"}.`,
    "/guardian/night",
  );
  return NextResponse.json(report);
}
