import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Always-on gate: every page and API needs a session except the public
// list below. Edge-safe checks (Web Crypto - node:crypto is unavailable).
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

/** Session cookie "exp.payloadHex.sig" (minted by /api/session). */
async function validSession(cookie: string | undefined, secret: string): Promise<boolean> {
  if (!cookie || !secret) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3) return false;
  const [exp, payloadHex, sig] = parts;
  if (!exp || !payloadHex || !sig || Number(exp) < Date.now()) return false;
  return hmacOk(secret, `${exp}.${payloadHex}`, sig);
}

/** Guest invite token: <room>.<exp>.<sig> for one meet room. */
async function validGuestToken(roomId: string, token: string | null, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== roomId) return false;
  if (Number(parts[1]) < Date.now()) return false;
  return hmacOk(secret, `${parts[0]}.${parts[1]}`, parts[2]);
}

/** Guest invite links: /meet/guest/<room>?token=<room>.<exp>.<sig>. */
async function validGuest(path: string, token: string | null, secret: string): Promise<boolean> {
  const m = path.match(/^\/meet\/guest\/([^/?]+)/);
  if (!m) return false;
  return validGuestToken(decodeURIComponent(m[1]), token, secret);
}

export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_KEY ?? "";
  if (await validSession(req.cookies.get("charie_session")?.value, secret)) return NextResponse.next();
  const path = req.nextUrl.pathname;
  // Guests reach only their room page; signaling APIs check the token themselves.
  if (path.startsWith("/meet/guest/") && (await validGuest(path, req.nextUrl.searchParams.get("token"), secret))) {
    return NextResponse.next();
  }
  // Meet API guests pass only with a valid signed invite for that room.
  // Check-in validates its body token + consent in the route itself.
  if (path.startsWith("/api/meet/rooms/")) {
    if (/^\/api\/meet\/rooms\/[^/]+\/guest$/.test(path)) return NextResponse.next();
    const m = path.match(/^\/api\/meet\/rooms\/([^/]+)\//);
    const token = req.nextUrl.searchParams.get("token");
    if (m && token && (await validGuestToken(decodeURIComponent(m[1]), token, secret))) return NextResponse.next();
  }
  // SDK/app ingestion carries its own key; the route validates it strictly.
  if (path === "/api/guardian/events" && req.headers.get("x-charie-key")) return NextResponse.next();
  // MCP over HTTP carries a Bearer API key; the route validates it strictly.
  if (path === "/api/mcp") return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/session|api/auth/config|api/github/webhook|api/cron/tick|__|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icon\\.svg|charie\\.js).*)"],
};
