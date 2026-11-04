// Meet presence: peers heartbeat with "ping" signals; anyone silent longer
// than the timeout is a ghost (closed tab, lost leave signal) and their tile
// is removed. Pure helpers so the expiry rule is unit tested.

export const PEER_TIMEOUT_MS = 25_000;

export function touchPeer(lastSeen: Record<string, number>, id: string, now: number): Record<string, number> {
  return { ...lastSeen, [id]: now };
}

export function stalePeerIds(lastSeen: Record<string, number>, now: number, timeoutMs: number = PEER_TIMEOUT_MS): string[] {
  return Object.entries(lastSeen)
    .filter(([, at]) => now - at > timeoutMs)
    .map(([id]) => id);
}
