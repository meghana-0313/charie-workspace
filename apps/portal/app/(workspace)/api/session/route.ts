import { NextResponse } from "next/server";
import {
  authConfigured, checkPassphrase, checkSeatSecret, mintSession, SESSION_COOKIE,
} from "@/lib/auth";
import { store } from "@/lib/store";

export async function POST(req: Request) {
  if (!authConfigured()) return NextResponse.json({ error: "auth not configured" }, { status: 400 });
  const { passphrase, name } = (await req.json().catch(() => ({}))) as { passphrase?: string; name?: string };
  if (!passphrase) return NextResponse.json({ error: "passphrase required" }, { status: 400 });
  const seat = String(name ?? "").trim();
  let who = "";
  if (seat) {
    const rec = await store.getSeatByName(seat).catch(() => null);
    if (!rec || !checkSeatSecret(passphrase, rec.salt, rec.passHash)) {
      return NextResponse.json({ error: "wrong name or passphrase" }, { status: 401 });
    }
    who = rec.name;
    await store.touchSeatLogin(rec.id).catch(() => {});
  } else if (!checkPassphrase(passphrase)) {
    return NextResponse.json({ error: "wrong passphrase" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, name: who || "Owner" });
  res.cookies.set(SESSION_COOKIE, mintSession(who), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
