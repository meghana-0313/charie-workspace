import { NextResponse } from "next/server";
import { mintSession, SESSION_COOKIE } from "@/lib/auth";
import { identity } from "@/lib/who";
import { store } from "@/lib/store";

const WEEK = 7 * 24 * 3600;

// Edit your user name. Updates the seat record and re-mints the session
// cookie so the new name shows everywhere immediately.
export async function POST(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) return NextResponse.json({ error: "name required" }, { status: 400 });
  const seat = await store.getSeatByEmail(id.email).catch(() => null);
  if (seat) {
    await store.saveSeat({ ...seat, name: clean }).catch(() => {});
    await store.linkSeatLogin(seat.id, { uid: id.uid, name: clean }).catch(() => {});
  }
  const res = NextResponse.json({ ok: true, name: clean });
  res.cookies.set(SESSION_COOKIE, mintSession({ uid: id.uid, email: id.email, name: clean }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WEEK,
  });
  return res;
}
