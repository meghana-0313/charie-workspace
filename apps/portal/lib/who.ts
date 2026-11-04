// Request identity: Firebase uid/email/name from the session cookie.
// Route handlers pass their Request (header parsing, no framework magic);
// server components omit it (next/headers).
import { cookies } from "next/headers";
import { sessionIdentity, SESSION_COOKIE, type SessionIdentity } from "./auth";

function fromHeader(header: string | null): SessionIdentity | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return sessionIdentity(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export async function identity(req?: Request): Promise<SessionIdentity | null> {
  if (req) return fromHeader(req.headers.get("cookie"));
  const jar = await cookies();
  return sessionIdentity(jar.get(SESSION_COOKIE)?.value);
}

/** Ownership scope for store reads/writes. Local owner mode and automation
 *  see and write shared (unowned) data; real users get their own uid. */
export function scopeUid(id: SessionIdentity | null): string | undefined {
  if (!id) return undefined;
  if (id.uid === "local-owner" || id.uid === "automation") return undefined;
  return id.uid;
}

/** Display name for authorship. Falls back to email, then a default. */
export async function displayName(req?: Request): Promise<string> {
  const id = await identity(req);
  return id?.name || id?.email || "Charie";
}

/** True when the caller may manage seats and keys (owner or admin seat). */
export async function isAdmin(
  store: { getSeatByEmail(e: string): Promise<{ role: string; owner?: boolean } | null> },
  req?: Request,
): Promise<boolean> {
  const id = await identity(req);
  if (!id) return false;
  if (id.uid === "local-owner" || id.uid === "automation") return true;
  const seat = await store.getSeatByEmail(id.email).catch(() => null);
  return seat?.owner === true || seat?.role === "admin";
}
