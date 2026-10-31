// Portal auth: shared passphrase + HMAC-signed session cookies.
// Stand-in for Firebase Auth (one console toggle + provider swap away): the
// login gate works today with zero extra provisioning. Secrets arrive as env
// (Cloud Run secret mounts); nothing is stored in the repo.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ghostqa_session";
const TTL_MS = 7 * 24 * 3600 * 1000;

function signingKey(): string {
  return process.env.SESSION_KEY ?? "dev-insecure-session-key";
}

/** False locally (no passphrase set) - the gate stays open for dev. */
export function authConfigured(): boolean {
  return (process.env.PORTAL_PASSPHRASE ?? "") !== "";
}

export function checkPassphrase(input: string): boolean {
  const expected = process.env.PORTAL_PASSPHRASE ?? "";
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function mintSession(): string {
  const exp = Date.now() + TTL_MS;
  const sig = createHmac("sha256", signingKey()).update(String(exp)).digest("base64url");
  return `${exp}.${sig}`;
}

export function checkSession(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const [exp, sig] = cookieValue.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = createHmac("sha256", signingKey()).update(exp).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
