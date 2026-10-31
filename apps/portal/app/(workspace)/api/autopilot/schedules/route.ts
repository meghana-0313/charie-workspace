import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import type { ScheduleKind, SchedulePreset } from "@/lib/types";

const KINDS: ScheduleKind[] = ["sweep", "pentest", "nightshift", "logwatch"];
const PRESETS: SchedulePreset[] = ["hourly", "daily", "weekly"];

export async function GET(req: Request) {
  return NextResponse.json({ schedules: await store.listSchedules(scopeUid(await identity(req))) });
}

export async function POST(req: Request) {
  const { kind, preset, target, enabled } = (await req.json().catch(() => ({}))) as {
    kind?: string; preset?: string; target?: string; enabled?: boolean;
  };
  if (!KINDS.includes(kind as ScheduleKind)) return NextResponse.json({ error: "kind must be sweep|pentest|nightshift|logwatch" }, { status: 400 });
  if (!PRESETS.includes(preset as SchedulePreset)) return NextResponse.json({ error: "preset must be hourly|daily|weekly" }, { status: 400 });
  const at = new Date().toISOString();
  const s = {
    id: uid("sch"),
    uid: scopeUid(await identity(req)),
    kind: kind as ScheduleKind,
    preset: preset as SchedulePreset,
    target: String(target ?? "").trim() || undefined,
    enabled: enabled !== false,
    createdAt: at,
    updatedAt: at,
  };
  await store.saveSchedule(s);
  return NextResponse.json(s, { status: 201 });
}
