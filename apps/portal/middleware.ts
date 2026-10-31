import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-safe checks (Web Crypto - node:crypto is unavailable here).
async function hmacOk(secret: string, message: string, sig: string): Promise<boolean> {
  if (!secret || !sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const want = Buffer.from(mac).toString("base64url");
  return sig === want;
}

async function validSession(cookie: string | undefined, secret: string): Promise<boolean> {
  if (!cookie || !secret) return false;
  const parts = cookie.split(".");
  if (parts.length === 3) {
    const [exp, nameHex] = parts;
    if (!exp || Number(exp) < Date.now()) return false;
    return hmacOk(secret, `${exp}.${nameHex}`, parts[2]);
  }
  if (parts.length === 2) {
    const [exp, sig] = parts;
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    return hmacOk(secret, exp, sig);
  }
  return false;
}

/** Guest invite links: /meet/guest/<room>?token=<room>.<exp>.<sig>. */
async function validGuest(path: string, token: string | null, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const m = path.match(/^\/meet\/guest\/([^/?]+)/);
  if (!m) return false;
  const roomId = decodeURIComponent(m[1]);
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== roomId) return false;
  if (Number(parts[1]) < Date.now()) return false;
  return hmacOk(secret, `${parts[0]}.${parts[1]}`, parts[2]);
}

export async function middleware(req: NextRequest) {
  if (!process.env.PORTAL_PASSPHRASE) return NextResponse.next(); // local dev, no gate
  const secret = process.env.SESSION_KEY ?? "";
  if (await validSession(req.cookies.get("charie_session")?.value, secret)) return NextResponse.next();
  const path = req.nextUrl.pathname;
  // Guests reach only their room page; signaling APIs check the token themselves.
  if (path.startsWith("/meet/guest/") && (await validGuest(path, req.nextUrl.searchParams.get("token"), secret))) {
    return NextResponse.next();
  }
  if (path.startsWith("/api/meet/") && req.nextUrl.searchParams.get("token")) return NextResponse.next();
  // SDK/app ingestion carries its own key; the route validates it strictly.
  if (path === "/api/guardian/events" && req.headers.get("x-charie-key")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/session|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icon\\.svg|charie\\.js).*)"],
};
