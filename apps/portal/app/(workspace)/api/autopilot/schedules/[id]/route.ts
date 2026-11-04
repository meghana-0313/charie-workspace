import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import type { SchedulePreset } from "@/lib/types";

function owned(uid: string | undefined, mine: string | undefined): boolean {
  return !mine || !uid || uid === mine;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await store.getSchedule(id);
  if (!s) return NextResponse.json({ error: "no such schedule" }, { status: 404 });
  if (!owned(s.uid, scopeUid(await identity(req)))) return NextResponse.json({ error: "not yours" }, { status: 403 });
  const { enabled, preset, target } = (await req.json().catch(() => ({}))) as {
    enabled?: boolean; preset?: string; target?: string;
  };
  const patch: Partial<typeof s> = { updatedAt: new Date().toISOString() };
  if (typeof enabled === "boolean") patch.enabled = enabled;
  if (preset === "hourly" || preset === "daily" || preset === "weekly") patch.preset = preset as SchedulePreset;
  if (typeof target === "string") patch.target = target.trim() || undefined;
  const next = { ...s, ...patch };
  await store.saveSchedule(next);
  return NextResponse.json(next);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await store.getSchedule(id);
  if (!s) return NextResponse.json({ error: "no such schedule" }, { status: 404 });
  if (!owned(s.uid, scopeUid(await identity(req)))) return NextResponse.json({ error: "not yours" }, { status: 403 });
  await store.deleteSchedule(id);
  return NextResponse.json({ ok: true });
}
