import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import type { SchedulePreset } from "@/lib/types";

function owned(uid: string | undefined, mine: string | undefined): boolean {
  return !mine || !uid || uid === mine;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await store.getSyncRule(id);
  if (!r) return NextResponse.json({ error: "no such rule" }, { status: 404 });
  if (!owned(r.uid, scopeUid(await identity(req)))) return NextResponse.json({ error: "not yours" }, { status: 403 });
  const { enabled, preset, jql, targetUrl } = (await req.json().catch(() => ({}))) as {
    enabled?: boolean; preset?: string; jql?: string; targetUrl?: string;
  };
  const patch: Partial<typeof r> = { updatedAt: new Date().toISOString() };
  if (typeof enabled === "boolean") patch.enabled = enabled;
  if (preset === "hourly" || preset === "daily" || preset === "weekly") patch.preset = preset as SchedulePreset;
  if (typeof jql === "string") patch.jql = jql.trim() || undefined;
  if (typeof targetUrl === "string" && targetUrl.trim()) {
    try {
      const u = new URL(targetUrl.trim());
      if (u.protocol === "http:" || u.protocol === "https:") patch.targetUrl = u.toString();
    } catch { /* keep old */ }
  }
  const next = { ...r, ...patch };
  await store.saveSyncRule(next);
  return NextResponse.json(next);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await store.getSyncRule(id);
  if (!r) return NextResponse.json({ error: "no such rule" }, { status: 404 });
  if (!owned(r.uid, scopeUid(await identity(req)))) return NextResponse.json({ error: "not yours" }, { status: 403 });
  await store.deleteSyncRule(id);
  return NextResponse.json({ ok: true });
}
