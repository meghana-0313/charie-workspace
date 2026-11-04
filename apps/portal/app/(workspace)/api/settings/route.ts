// Workspace settings: the editable knobs behind the Settings page.
// workspaceName (sidebar), defaultTargetUrl (ticket/scan prefill),
// prodProjectId (log watch, shared with the logwatch route), and the
// autopilot master pause the cron tick honors. Reads: any member.
// Writes: admins and the owner only.
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity, isAdmin } from "@/lib/who";

const KEYS = ["workspaceName", "defaultTargetUrl", "prodProjectId", "autopilotPaused"] as const;

async function readAll(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of KEYS) out[k] = (await store.getSetting(k).catch(() => null)) ?? "";
  return out;
}

export async function GET(req: Request) {
  if (!(await identity(req))) return NextResponse.json({ error: "login required" }, { status: 401 });
  return NextResponse.json(await readAll());
}

export async function POST(req: Request) {
  if (!(await identity(req))) return NextResponse.json({ error: "login required" }, { status: 401 });
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const url = String(body.defaultTargetUrl ?? "").trim();
  if (url) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "defaultTargetUrl must be a valid URL" }, { status: 400 });
    }
  }
  const name = String(body.workspaceName ?? "").trim().slice(0, 40);
  const projectId = String(body.prodProjectId ?? "").trim().slice(0, 80);
  await store.setSetting("workspaceName", name);
  await store.setSetting("defaultTargetUrl", url);
  await store.setSetting("prodProjectId", projectId);
  await store.setSetting("autopilotPaused", body.autopilotPaused === true || body.autopilotPaused === "1" ? "1" : "0");
  return NextResponse.json(await readAll());
}
