import { NextResponse } from "next/server";
import { pollBuild } from "@/lib/repos";

export const maxDuration = 300;

// GET /api/builds/[id] - poll Cloud Build and advance deploy/test. Idempotent.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await pollBuild(id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
