import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { signingKey } from "@/lib/auth";
import { identity } from "@/lib/who";

// Start one-click GitHub connect: redirect to the OAuth App authorize page.
// State is HMAC-signed (uid + expiry) so the callback trusts it.
export async function GET(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID ?? "";
  if (!clientId) {
    return NextResponse.json({
      error: "GitHub OAuth is not set up yet. Create an OAuth App (Settings > Developer settings > OAuth Apps): homepage = portal URL, callback = <portal>/api/github/oauth/callback. Then set GITHUB_OAUTH_CLIENT_ID + GITHUB_OAUTH_CLIENT_SECRET. PAT connect below keeps working meanwhile.",
    }, { status: 400 });
  }
  const origin = new URL(req.url).origin;
  const exp = Date.now() + 10 * 60 * 1000;
  const sig = createHmac("sha256", signingKey())
    .update(`${id.uid}.${exp}`).digest("base64url");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/github/oauth/callback`,
    scope: "repo",
    state: `${id.uid}.${exp}.${sig}`,
  });
  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
