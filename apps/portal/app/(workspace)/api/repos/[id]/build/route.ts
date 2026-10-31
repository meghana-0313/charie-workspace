import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { startBuild } from "@/lib/repos";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await store.getRepo(id);
  if (!repo) return NextResponse.json({ error: "unknown repo" }, { status: 404 });
  try {
    const build = await startBuild(id);
    return NextResponse.json(build, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
