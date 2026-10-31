// Request identity: seat name from the session cookie.
// "" = owner (shared passphrase), null = invalid/anonymous.
// Route handlers pass their Request (header parsing, no framework magic);
// server components omit it (next/headers).
import { cookies } from "next/headers";
import { checkSession, SESSION_COOKIE } from "./auth";

function fromHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return checkSession(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export async function seatName(req?: Request): Promise<string | null> {
  if (req) return fromHeader(req.headers.get("cookie"));
  const jar = await cookies();
  return checkSession(jar.get(SESSION_COOKIE)?.value);
}

/** Display name for authorship. Falls back to the owner label. */
export async function displayName(req?: Request): Promise<string> {
  return (await seatName(req)) || "Owner";
}

/** True when the caller may manage seats and keys (owner or admin seat). */
export async function isAdmin(store: { getSeatByName(n: string): Promise<{ role: string } | null> }, req?: Request): Promise<boolean> {
  const who = await seatName(req);
  if (who === null) return false;
  if (who === "") return true;
  return (await store.getSeatByName(who).catch(() => null))?.role === "admin";
}
