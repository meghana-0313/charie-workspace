// Seeded demo attack: a credential-stuffing run against the SIMULATED
// environment. Deterministic enough for demos: same shape every time.

import type { GuardEventView } from "./types";
import { uid } from "./uid";

const ATTACK_IP = "203.0.113.9";

export function seedStuffingAttack(): GuardEventView[] {
  const events: GuardEventView[] = [];
  const t0 = Date.now() - 12 * 60 * 1000;
  const at = (sec: number) => new Date(t0 + sec * 1000).toISOString();
  const users = ["ana", "ben", "cara", "dev", "ella", "finn"];

  // A little benign background first.
  for (let i = 0; i < 6; i++) {
    events.push({
      id: uid("gev"), ts: at(i * 20), kind: "auth", actor: users[i % users.length],
      ip: "198.51.100.21", outcome: "success", country: "US",
    });
  }
  // The stuffing run: 42 failures across 6 accounts from one IP.
  for (let i = 0; i < 42; i++) {
    events.push({
      id: uid("gev"), ts: at(150 + i * 8), kind: "auth", actor: users[i % users.length],
      ip: ATTACK_IP, outcome: "failure", country: "US",
    });
  }
  // One account breaks: success from a new country, then sensitive access.
  events.push({
    id: uid("gev"), ts: at(500), kind: "auth", actor: "cara", ip: ATTACK_IP,
    outcome: "success", country: "XX",
  });
  for (const ep of ["/admin/users", "/api/billing/export", "/admin/audit", "/api/tokens"]) {
    events.push({
      id: uid("gev"), ts: at(510 + events.length), kind: "api", actor: "cara", ip: ATTACK_IP,
      endpoint: ep, outcome: "success", country: "XX",
    });
  }
  return events;
}
