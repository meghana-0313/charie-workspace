import { NextResponse } from "next/server";
import { runA11y } from "@/lib/guardian";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { targetUrl } = (await req.json().catch(() => ({}))) as { targetUrl?: string };
  if (!targetUrl) return NextResponse.json({ error: "targetUrl required" }, { status: 400 });
  const report = await runA11y(targetUrl);
  if (!report) return NextResponse.json({ error: "engine unreachable or target failed to load" }, { status: 502 });
  return NextResponse.json(report);
}
