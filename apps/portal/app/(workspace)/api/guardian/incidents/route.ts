import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  const me = await identity(req);
  if (!me) return NextResponse.json({ error: "login required" }, { status: 401 });
  const scope = scopeUid(me);
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const inc = await store.getIncident(id);
    if (!inc) return NextResponse.json({ error: "unknown incident" }, { status: 404 });
    if (scope && inc.uid && inc.uid !== scope) return NextResponse.json({ error: "unknown incident" }, { status: 404 });
    return NextResponse.json(inc);
  }
  return NextResponse.json(await store.listIncidents(scope));
}
