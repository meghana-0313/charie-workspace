import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { lastLogWatch, runLogWatch } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";

const KEY = "prodProjectId";

export async function GET(req: Request) {
  const [projectId, report] = await Promise.all([
    store.getSetting(KEY).catch(() => null),
    lastLogWatch(scopeUid(await identity(req))).catch(() => null),
  ]);
  return NextResponse.json({ projectId: projectId ?? null, report });
}

export async function POST(req: Request) {
  const { projectId } = (await req.json().catch(() => ({}))) as { projectId?: string };
  const id = String(projectId ?? "").trim() || process.env.GCP_PROJECT_ID || "";
  if (!id) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  await store.setSetting(KEY, id).catch(() => {});
  const report = await runLogWatch(id, scopeUid(await identity(req)));
  if (!report) return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  return NextResponse.json(report);
}
