import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { executeSchedule } from "@/lib/autopilot";
import { identity, scopeUid } from "@/lib/who";

export const maxDuration = 300;

// POST /api/autopilot/schedules/[id]/run - run once now (session authed).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await store.getSchedule(id);
  if (!s) return NextResponse.json({ error: "no such schedule" }, { status: 404 });
  const mine = scopeUid(await identity(req));
  if ((await identity(req)) === null) return NextResponse.json({ error: "login required" }, { status: 401 });
  if (mine && s.uid && s.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  const status = await executeSchedule(s);
  const at = new Date().toISOString();
  await store.saveSchedule({ ...s, lastRunAt: at, lastStatus: status, updatedAt: at });
  return NextResponse.json({ id, status });
}
