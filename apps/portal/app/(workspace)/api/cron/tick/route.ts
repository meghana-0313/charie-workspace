import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { automationKeyOk } from "@/lib/auth";
import { tickAutopilot } from "@/lib/autopilot";

export const maxDuration = 300;

// Scheduler entrypoint (Cloud Scheduler hits this every 15 min in prod).
// Auth: CRON_KEY (query ?key= or x-cron-key header) or the AUTOMATION_KEY.
function cronOk(req: Request): boolean {
  const got = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-cron-key") ?? "";
  if (automationKeyOk(got)) return true;
  const expected = process.env.CRON_KEY ?? "";
  if (!got || !expected) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function tick(req: Request) {
  if (!cronOk(req)) return NextResponse.json({ error: "bad cron key" }, { status: 403 });
  return NextResponse.json(await tickAutopilot());
}

export async function GET(req: Request) {
  return tick(req);
}

export async function POST(req: Request) {
  return tick(req);
}
