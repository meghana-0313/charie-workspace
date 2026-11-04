import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase";
import { automationKeyOk, devLoginAllowed, mintSession, SESSION_COOKIE } from "@/lib/auth";
import { identity } from "@/lib/who";
import { store, uid } from "@/lib/store";
import { DEMO_EMAIL, DEMO_NAME, DEMO_UID, ensureDemoWorkspace } from "@/lib/demo";

const WEEK = 7 * 24 * 3600;

function setSession(res: NextResponse, value: string, maxAge: number): void {
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    idToken?: string; localOwner?: boolean; key?: string; userName?: string;
  };

  // 1. Firebase ID token (Google sign-in from the login page).
  if (typeof body.idToken === "string" && body.idToken) {
    let decoded: { uid: string; email?: string; name?: string };
    try {
      decoded = await getAuth(adminApp()).verifyIdToken(body.idToken);
    } catch {
      return NextResponse.json({ error: "bad id token" }, { status: 401 });
    }
    const email = String(decoded.email ?? "").toLowerCase();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 401 });
    const chosen = String(body.userName ?? "").trim().slice(0, 60);
    const seat = await store.getSeatByEmail(email).catch(() => null);
    // A name saved in Settings wins over the identity token, which can keep
    // carrying an old display name forever (the incognito stale-name bug).
    const name = (seat?.name ?? "").trim() || chosen || String(decoded.name ?? email.split("@")[0]);
    if (!seat) {
      const all = await store.listSeats().catch(() => []);
      if (all.length > 0) return NextResponse.json({ error: "not invited" }, { status: 403 });
      // First ever login bootstraps the owner seat.
      await store.saveSeat({
        id: uid("seat"), email, name, role: "admin", owner: true,
        uid: decoded.uid, createdAt: new Date().toISOString(),
      });
    } else {
      await store.linkSeatLogin(seat.id, { uid: decoded.uid, name }).catch(() => {});
    }
    const res = NextResponse.json({ ok: true, name });
    setSession(res, mintSession({ uid: decoded.uid, email, name }), WEEK);
    return res;
  }

  // 2. Demo Mode (public, no login): a restricted session scoped to the
  // seeded demo workspace uid. Per-account scoping is the isolation
  // boundary - this session can only see and change demo records.
  if ((body as { demo?: boolean }).demo === true) {
    await ensureDemoWorkspace().catch(() => {});
    const res = NextResponse.json({ ok: true, name: DEMO_NAME, demo: true });
    setSession(res, mintSession({ uid: DEMO_UID, email: DEMO_EMAIL, name: DEMO_NAME }), WEEK);
    return res;
  }

  // 3. Local owner (file-store mode only: judges, local dev).
  if (body.localOwner === true) {
    if (!devLoginAllowed()) return NextResponse.json({ error: "dev login disabled" }, { status: 403 });
    const res = NextResponse.json({ ok: true, name: "Local owner" });
    setSession(res, mintSession({ uid: "local-owner", email: "owner@localhost", name: "Local owner" }), WEEK);
    return res;
  }

  // 3. Automation key (CI/verify, AUTOMATION_KEY secret).
  if (typeof body.key === "string" && automationKeyOk(body.key)) {
    const res = NextResponse.json({ ok: true, name: "Automation" });
    setSession(res, mintSession({ uid: "automation", email: "automation@localhost", name: "Automation" }), WEEK);
    return res;
  }

  return NextResponse.json({ error: "idToken, localOwner, or key required" }, { status: 400 });
}

export async function GET(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, name: id.name || id.email });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  // Explicit clear (not cookies.delete) so the flags match the set cookie.
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}
