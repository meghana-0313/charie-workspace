import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Edge-safe session check (Web Crypto — node:crypto is unavailable here).
async function valid(cookie: string | undefined, secret: string): Promise<boolean> {
  if (!cookie || !secret) return false;
  const [exp, sig] = cookie.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(exp));
  const want = Buffer.from(mac).toString("base64url");
  return sig === want;
}

export async function middleware(req: NextRequest) {
  if (!process.env.PORTAL_PASSPHRASE) return NextResponse.next(); // local dev, no gate
  const ok = await valid(req.cookies.get("ghostqa_session")?.value, process.env.SESSION_KEY ?? "");
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/session|_next/static|_next/image|favicon.ico).*)"],
};
