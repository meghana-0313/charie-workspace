// Portal auth: team seats + shared passphrase, HMAC-signed sessions.
// Sessions: "exp.nameHex.sig" (named seat) or legacy "exp.sig" (owner).
// Meet guest invites: "roomId.exp.sig", verified at the edge and in routes.

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "charie_session";
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

export function hashSeatSecret(secret: string, salt: string): string {
  return scryptSync(secret, salt, 32).toString("hex");
}

export function checkSeatSecret(secret: string, salt: string, hash: string): boolean {
  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(hashSeatSecret(secret, salt), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Mint a session. Name "" = owner (legacy shared passphrase). */
export function mintSession(name = ""): string {
  const exp = Date.now() + TTL_MS;
  const nameHex = Buffer.from(name, "utf8").toString("hex");
  const sig = createHmac("sha256", signingKey()).update(`${exp}.${nameHex}`).digest("base64url");
  return name ? `${exp}.${nameHex}.${sig}` : `${exp}.${sig}`;
}

/** Returns the seat name ("" for owner) or null when invalid. */
export function checkSession(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  let exp = "";
  let nameHex = "";
  let sig = "";
  if (parts.length === 3) {
    [exp, nameHex, sig] = parts;
  } else if (parts.length === 2) {
    [exp, sig] = parts;
  } else {
    return null;
  }
  if (!exp || !sig || Number(exp) < Date.now()) return null;
  const want = createHmac("sha256", signingKey()).update(parts.length === 3 ? `${exp}.${nameHex}` : exp).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return parts.length === 3 ? Buffer.from(nameHex, "hex").toString("utf8") : "";
  } catch {
    return null;
  }
}

const INVITE_TTL_MS = 24 * 3600 * 1000;

/** Signed guest invite for one meet room. Stateless: anyone with the link joins. */
export function mintInvite(roomId: string): string {
  const exp = Date.now() + INVITE_TTL_MS;
  const sig = createHmac("sha256", signingKey()).update(`${roomId}.${exp}`).digest("base64url");
  return `${roomId}.${exp}.${sig}`;
}

export function checkInvite(roomId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [rid, exp, sig] = parts;
  if (rid !== roomId || !exp || !sig || Number(exp) < Date.now()) return false;
  const want = createHmac("sha256", signingKey()).update(`${rid}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
