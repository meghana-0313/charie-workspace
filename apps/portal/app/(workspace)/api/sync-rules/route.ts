import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import type { SchedulePreset } from "@/lib/types";

const PRESETS: SchedulePreset[] = ["hourly", "daily", "weekly"];

export async function GET(req: Request) {
  return NextResponse.json({ rules: await store.listSyncRules(scopeUid(await identity(req))) });
}

export async function POST(req: Request) {
  const { connectorId, project, jql, targetUrl, preset, doneTransitionId } = (await req.json().catch(() => ({}))) as {
    connectorId?: string; project?: string; jql?: string; targetUrl?: string; preset?: string; doneTransitionId?: string;
  };
  const conn = connectorId ? await store.getConnector(connectorId) : null;
  if (!conn || conn.kind !== "jira") return NextResponse.json({ error: "a Jira connector is required" }, { status: 400 });
  const mine = scopeUid(await identity(req));
  if (mine && conn.uid && conn.uid !== mine) return NextResponse.json({ error: "not your connector" }, { status: 403 });
  let target = "";
  try {
    const u = new URL(String(targetUrl ?? "").trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad");
    target = u.toString();
  } catch {
    return NextResponse.json({ error: "a valid http(s) targetUrl is required" }, { status: 400 });
  }
  if (!PRESETS.includes(preset as SchedulePreset)) return NextResponse.json({ error: "preset must be hourly|daily|weekly" }, { status: 400 });
  const at = new Date().toISOString();
  const r = {
    id: uid("rule"), uid: mine, connectorId: conn.id, kind: "jira-pull" as const,
    project: String(project ?? "").trim().toUpperCase() || undefined,
    jql: String(jql ?? "").trim() || undefined,
    targetUrl: target, preset: preset as SchedulePreset, enabled: true,
    importedKeys: [], doneTransitionId: String(doneTransitionId ?? "").trim() || undefined,
    createdAt: at, updatedAt: at,
  };
  await store.saveSyncRule(r);
  return NextResponse.json(r, { status: 201 });
}
