import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const inc = await store.getIncident(id);
    if (!inc) return NextResponse.json({ error: "unknown incident" }, { status: 404 });
    return NextResponse.json(inc);
  }
  return NextResponse.json(await store.listIncidents());
}
