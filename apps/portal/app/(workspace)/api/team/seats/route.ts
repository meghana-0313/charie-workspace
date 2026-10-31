import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hashSeatSecret } from "@/lib/auth";
import { store, uid } from "@/lib/store";
import { isAdmin } from "@/lib/who";

export async function GET(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const seats = (await store.listSeats()).map(({ passHash, salt, ...rest }) => rest);
  return NextResponse.json({ seats });
}

export async function POST(req: Request) {
  if (!(await isAdmin(store, req))) return NextResponse.json({ error: "admin only" }, { status: 403 });
  const { name, role } = (await req.json().catch(() => ({}))) as { name?: string; role?: string };
  const clean = String(name ?? "").trim().slice(0, 40);
  if (!clean) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (await store.getSeatByName(clean)) return NextResponse.json({ error: "seat exists" }, { status: 409 });
  const passphrase = `charie-${randomBytes(9).toString("base64url")}`;
  const salt = randomBytes(16).toString("hex");
  const seat = {
    id: uid("seat"), name: clean, role: (role === "admin" ? "admin" : "member") as "admin" | "member",
    salt, passHash: hashSeatSecret(passphrase, salt), createdAt: new Date().toISOString(),
  };
  await store.saveSeat(seat);
  return NextResponse.json({ name: seat.name, role: seat.role, passphrase }, { status: 201 });
}
