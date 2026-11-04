import { NextResponse } from "next/server";
import { DEMO_UID, resetDemoWorkspace } from "@/lib/demo";
import { identity } from "@/lib/who";

// Reset restores the seeded demo dataset. Demo session only: the caller
// must be the demo workspace itself, so this can never touch real data.
export async function POST(req: Request) {
  const id = await identity(req);
  if (!id || id.uid !== DEMO_UID) {
    return NextResponse.json({ error: "demo session required" }, { status: 403 });
  }
  await resetDemoWorkspace();
  return NextResponse.json({ ok: true });
}
