import { NextResponse } from "next/server";
import { authConfigured, checkPassphrase, mintSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  if (!authConfigured()) return NextResponse.json({ error: "auth not configured" }, { status: 400 });
  const { passphrase } = (await req.json().catch(() => ({}))) as { passphrase?: string };
  if (!passphrase || !checkPassphrase(passphrase)) {
    return NextResponse.json({ error: "wrong passphrase" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, mintSession(), {
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
