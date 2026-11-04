// Portal auth: Firebase Google sign-in, HMAC-signed session cookies.
// The browser signs in with Firebase (Google), POSTs the ID token to
// /api/session, and gets an httpOnly session cookie: "exp.payloadHex.sig"
// where payload is JSON {uid, email, name}. The edge middleware re-checks
// the HMAC without needing Firebase Admin.
// Meet guest invites: "roomId.exp.sig", verified at the edge and in routes.

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "charie_session";
const TTL_MS = 7 * 24 * 3600 * 1000;

export interface SessionIdentity {
  uid: string;
  email: string;
  name: string;
}

export function signingKey(): string {
  const key = process.env.SESSION_KEY ?? "";
  if (key.length >= 16) return key;
  // Hosted (Firestore) mode must never sign with a guessable key: fail closed.
  // Local file-store runs keep the dev fallback so judges can run offline.
  if (process.env.NODE_ENV === "production" && process.env.PORTAL_STORE === "firestore") {
    throw new Error("SESSION_KEY is missing or too short; refusing to sign sessions");
  }
  return "dev-insecure-session-key";
}

/** Local file-store mode allows one-click local owner login (judges, dev). */
export function devLoginAllowed(): boolean {
  return process.env.PORTAL_STORE !== "firestore";
}

/** scrypt hash for stored secrets (API keys). Salted hex. */
export function hashSecret(secret: string, salt: string): string {
  return scryptSync(secret, salt, 32).toString("hex");
}

export function mintSession(id: SessionIdentity): string {
  const exp = Date.now() + TTL_MS;
  const payloadHex = Buffer.from(JSON.stringify(id), "utf8").toString("hex");
  const sig = createHmac("sha256", signingKey()).update(`${exp}.${payloadHex}`).digest("base64url");
  return `${exp}.${payloadHex}.${sig}`;
}

/** Returns the identity or null when missing, expired, or tampered. */
export function sessionIdentity(cookieValue: string | undefined): SessionIdentity | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [exp, payloadHex, sig] = parts;
  if (!exp || !payloadHex || !sig || Number(exp) < Date.now()) return null;
  const want = createHmac("sha256", signingKey()).update(`${exp}.${payloadHex}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const id = JSON.parse(Buffer.from(payloadHex, "hex").toString("utf8")) as SessionIdentity;
    if (!id || typeof id.uid !== "string" || !id.uid) return null;
    return { uid: id.uid, email: String(id.email ?? ""), name: String(id.name ?? "") };
  } catch {
    return null;
  }
}

/** CI/automation key (AUTOMATION_KEY secret). False when unset. */
export function automationKeyOk(key: string | undefined | null): boolean {
  const expected = process.env.AUTOMATION_KEY ?? "";
  if (!key || !expected) return false;
  const a = Buffer.from(String(key));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
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
