import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { store } from "@/lib/store";
import { exchangeOAuthCode, getViewer } from "@/lib/github";

// OAuth callback: verify state, exchange the code, store the user token.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const base = url.origin;
  const fail = (msg: string) => NextResponse.redirect(`${base}/repos?github=${encodeURIComponent(msg)}`);
  const [uid, exp, sig] = state.split(".");
  if (!uid || !exp || !sig || Number(exp) < Date.now()) return fail("expired");
  const want = createHmac("sha256", process.env.SESSION_KEY ?? "dev-insecure-session-key")
    .update(`${uid}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail("bad-state");
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID ?? "";
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret || !code) return fail("not-configured");
  const token = await exchangeOAuthCode({
    clientId, clientSecret, code, redirectUri: `${base}/api/github/oauth/callback`,
  });
  if (!token) return fail("exchange-failed");
  const login = await getViewer(token);
  const at = new Date().toISOString();
  await store.saveGithubToken({ uid, token, login: login ?? undefined, createdAt: at, updatedAt: at });
  return NextResponse.redirect(`${base}/repos?github=connected`);
}
