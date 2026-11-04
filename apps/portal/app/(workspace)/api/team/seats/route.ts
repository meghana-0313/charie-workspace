import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { identity, isAdmin, scopeUid } from "@/lib/who";

export async function GET(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const seats = await store.listSeats();
  // Demo callers are admin over the sandbox only: never hand them the
  // real workspace seat list (emails). Sample seats carry demo- ids.
  const me = scopeUid(await identity(req));
  return NextResponse.json({ seats: me === "demo-workspace" ? seats.filter((s) => s.id.startsWith("demo-")) : seats });
}

export async function POST(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { email, role } = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
  const clean = String(email ?? "").trim().toLowerCase().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return NextResponse.json({ error: "valid email required" }, { status: 400 });
  if (await store.getSeatByEmail(clean)) return NextResponse.json({ error: "seat exists" }, { status: 409 });
  const seat = {
    id: uid("seat"), email: clean, role: (role === "admin" ? "admin" : "member") as "admin" | "member",
    createdAt: new Date().toISOString(),
  };
  await store.saveSeat(seat);
  return NextResponse.json(seat, { status: 201 });
}
