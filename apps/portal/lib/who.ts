// Request identity: seat name from the session cookie.
// "" = owner (shared passphrase), null = invalid/anonymous.
import { cookies } from "next/headers";
import { checkSession, SESSION_COOKIE } from "./auth";

export async function seatName(): Promise<string | null> {
  const jar = await cookies();
  return checkSession(jar.get(SESSION_COOKIE)?.value);
}

/** Display name for authorship. Falls back to the owner label. */
export async function displayName(): Promise<string> {
  return (await seatName()) || "Owner";
}

/** True when the caller may manage seats and keys (owner or admin seat). */
export async function isAdmin(store: { getSeatByName(n: string): Promise<{ role: string } | null> }): Promise<boolean> {
  const who = await seatName();
  if (who === null) return false;
  if (who === "") return true;
  return (await store.getSeatByName(who).catch(() => null))?.role === "admin";
}
