import { NextResponse } from "next/server";
import { runFirstRun } from "@/lib/guardian";
import { identity, scopeUid } from "@/lib/who";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { targetUrl } = (await req.json().catch(() => ({}))) as { targetUrl?: string };
  if (!targetUrl) return NextResponse.json({ error: "targetUrl required" }, { status: 400 });
  const report = await runFirstRun(targetUrl, scopeUid(await identity(req)));
  if (!report) return NextResponse.json({ error: "engine unreachable or target failed to load" }, { status: 502 });
  return NextResponse.json(report);
}
