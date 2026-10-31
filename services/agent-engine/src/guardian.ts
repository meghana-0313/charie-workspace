// Runtime Guardian: post-deploy security monitoring and incident response.
// Deterministic detectors find signals in event windows; Meta models
// interpret them (Glimmer classifies, Spark investigates, Spark Open
// challenges, Wonder plans critical responses). Response actions execute
// against a SIMULATED environment only - nothing here touches real prod.

import { secondOpinion } from "./baseten.js";
import { glimmerComplete } from "./glimmer.js";
import { chat, modelId } from "./meta-client.js";
import { secret } from "./secrets.js";
import type { FetchImpl } from "./baseten.js";

export interface GuardEvent {
  id: string;
  ts: string; // ISO timestamp
  kind: "auth" | "api" | "traffic" | "infra";
  actor?: string;
  ip?: string;
  endpoint?: string;
  outcome?: "success" | "failure" | "deny" | "allow";
  country?: string;
  bytes?: number;
  records?: number;
}

export type SignalType = "credential-stuffing" | "account-takeover" | "api-abuse" | "exfiltration";

export interface GuardSignal {
  type: SignalType;
  severity: "blocker" | "major" | "minor";
  title: string;
  evidence: string[];
  eventIds: string[];
  actors: string[];
  ips: string[];
}

const SENSITIVE = /admin|billing|payment|password|secret|token|export|ssn|salary/i;

function uniq(xs: Array<string | undefined>): string[] {
  return [...new Set(xs.filter(Boolean) as string[])];
}

function detectStuffing(events: GuardEvent[]): GuardSignal | null {
  const fails = events.filter((e) => e.kind === "auth" && e.outcome === "failure");
  const actors = uniq(fails.map((e) => e.actor));
  const ips = uniq(fails.map((e) => e.ip));
  if (fails.length >= 20 && actors.length >= 3) {
    return {
      type: "credential-stuffing",
      severity: "blocker",
      title: `${fails.length} failed logins across ${actors.length} accounts`,
      evidence: [
        `${fails.length} failed authentications in the window`,
        `${actors.length} distinct accounts targeted (${actors.slice(0, 5).join(", ")})`,
        `source IPs: ${ips.slice(0, 5).join(", ") || "unknown"}`,
      ],
      eventIds: fails.map((e) => e.id),
      actors,
      ips,
    };
  }
  return null;
}

function detectTakeover(events: GuardEvent[]): GuardSignal | null {
  const fails = events.filter((e) => e.kind === "auth" && e.outcome === "failure");
  for (const actor of uniq(fails.map((e) => e.actor))) {
    const mine = events.filter((e) => e.actor === actor);
    const success = mine.find((e) => e.kind === "auth" && e.outcome === "success");
    if (!success) continue;
    const failCount = mine.filter((e) => e.outcome === "failure").length;
    if (failCount < 3) continue;
    const countries = uniq(mine.map((e) => e.country));
    const sensitive = mine.filter((e) => e.endpoint && SENSITIVE.test(e.endpoint));
    const oddCountry = countries.length > 1 ? countries[countries.length - 1] : null;
    if (oddCountry || sensitive.length > 0) {
      return {
        type: "account-takeover",
        severity: "blocker",
        title: `Possible account takeover: ${actor}`,
        evidence: [
          `${failCount} failures then a success for ${actor}`,
          ...(oddCountry ? [`authenticated from unusual country: ${oddCountry}`] : []),
          ...(sensitive.length > 0 ? [`touched ${sensitive.length} sensitive endpoints`] : []),
        ],
        eventIds: mine.map((e) => e.id),
        actors: [actor],
        ips: uniq(mine.map((e) => e.ip)),
      };
    }
  }
  return null;
}

function detectApiAbuse(events: GuardEvent[]): GuardSignal | null {
  const hits = events.filter((e) => e.kind === "api" && e.endpoint && SENSITIVE.test(e.endpoint));
  const byIp = new Map<string, GuardEvent[]>();
  for (const h of hits) {
    const k = h.ip ?? "unknown";
    byIp.set(k, [...(byIp.get(k) ?? []), h]);
  }
  for (const [ip, list] of byIp) {
    if (list.length >= 30) {
      return {
        type: "api-abuse",
        severity: "major",
        title: `API abuse from ${ip}: ${list.length} sensitive hits`,
        evidence: [`${list.length} sensitive-endpoint calls from one IP`, `endpoints: ${uniq(list.map((e) => e.endpoint)).slice(0, 5).join(", ")}`],
        eventIds: list.map((e) => e.id),
        actors: uniq(list.map((e) => e.actor)),
        ips: [ip],
      };
    }
  }
  return null;
}

function detectExfil(events: GuardEvent[]): GuardSignal | null {
  const big = events.filter((e) => (e.bytes ?? 0) > 5_000_000 || (e.records ?? 0) > 1000);
  if (big.length >= 3) {
    const totalBytes = big.reduce((n, e) => n + (e.bytes ?? 0), 0);
    return {
      type: "exfiltration",
      severity: "major",
      title: `Possible data exfiltration: ${big.length} bulk transfers`,
      evidence: [
        `${big.length} transfers over thresholds`,
        `${(totalBytes / 1_000_000).toFixed(1)} MB total outbound`,
        `actors: ${uniq(big.map((e) => e.actor)).slice(0, 5).join(", ") || "unknown"}`,
      ],
      eventIds: big.map((e) => e.id),
      actors: uniq(big.map((e) => e.actor)),
      ips: uniq(big.map((e) => e.ip)),
    };
  }
  return null;
}

/** Run all deterministic detectors over an event window. Pure function. */
export function detectSignals(events: GuardEvent[]): GuardSignal[] {
  return [detectStuffing(events), detectTakeover(events), detectApiAbuse(events), detectExfil(events)].filter(
    (s): s is GuardSignal => s !== null,
  );
}

export interface Investigation {
  verdict: string;
  severity: "blocker" | "major" | "minor";
  summary: string;
  timeline: string[];
  plan: string[];
  disagreement: string | null;
  glimmerFiltered: number;
}

export function parseInvestigation(text: string): Omit<Investigation, "disagreement" | "glimmerFiltered"> | null {
  const lines = text.split("\n");
  const one = (name: string): string => {
    const l = lines.find((x) => x.startsWith(`${name}:`));
    return l ? l.slice(name.length + 1).trim() : "";
  };
  const section = (name: string): string[] => {
    const out: string[] = [];
    let on = false;
    for (const l of lines) {
      if (l.trim() === `${name}:`) {
        on = true;
        continue;
      }
      if (on && /^[A-Z]+:/.test(l.trim())) break;
      if (on) {
        const t = l.replace(/^-\s*/, "").trim();
        if (t) out.push(t);
      }
    }
    return out;
  };
  const severity = one("SEVERITY");
  const verdict = one("VERDICT");
  if (!verdict || (severity !== "blocker" && severity !== "major" && severity !== "minor")) return null;
  return { verdict, severity, summary: one("SUMMARY"), timeline: section("TIMELINE"), plan: section("PLAN") };
}

async function glimmerIsNoise(signal: GuardSignal, fetchImpl: FetchImpl): Promise<boolean> {
  const out = await glimmerComplete(
    [
      { role: "system", content: "You filter security signals. Reply with exactly one word: THREAT or NOISE." },
      { role: "user", content: `${signal.title}\n${signal.evidence.join("\n")}` },
    ],
    { maxTokens: 10, fetchImpl, quiet: true },
  );
  // Unreachable Glimmer must never drop a signal - fail open, filter nothing.
  if (!out) return false;
  return out.trim().toUpperCase() === "NOISE";
}

/**
 * Full investigation: Glimmer pre-filters noise, Spark investigates, Spark Open
 * challenges the verdict, Wonder deep-plans critical cases. Null without keys.
 */
export async function investigate(
  signals: GuardSignal[],
  fetchImpl: FetchImpl = fetch,
): Promise<Investigation | null> {
  if (signals.length === 0) return null;
  if (!secret("META_API_KEY")) return null;
  let filtered = 0;
  const kept: GuardSignal[] = [];
  for (const s of signals) {
    if (await glimmerIsNoise(s, fetchImpl)) filtered++;
    else kept.push(s);
  }
  if (kept.length === 0) return null;
  const brief = kept.map((s) => `[${s.severity}] ${s.type}: ${s.title}\n${s.evidence.map((e) => `- ${e}`).join("\n")}`).join("\n\n");
  let report: string;
  try {
    report = await chat(
      [
        {
          role: "system",
          content:
            "You are a security incident responder. Reply in exactly this shape:\nVERDICT: <one line>\nSEVERITY: <blocker|major|minor>\nSUMMARY: <one paragraph>\nTIMELINE:\n- <ordered facts>\nPLAN:\n- <containment steps, highest impact first>",
        },
        { role: "user", content: `Signals from the last window:\n\n${brief}` },
      ],
      { model: modelId("spark"), maxTokens: 2000, fetchImpl },
    );
  } catch (e) {
    console.warn(`[guardian] Spark investigation skipped: ${(e as Error).message}`);
    return null;
  }
  const parsed = parseInvestigation(report);
  if (!parsed) return null;

  // Spark Open adversarial second opinion on the verdict itself.
  let disagreement: string | null = null;
  const challenge = await secondOpinion(
    {
      title: `Security verdict: ${parsed.verdict}`,
      category: "security",
      severity: parsed.severity,
      suspectedCause: parsed.summary,
      suggestedFix: parsed.plan.join("; "),
    },
    fetchImpl,
  );
  if (challenge && challenge.severity !== parsed.severity) {
    disagreement = `Spark Open grades this ${challenge.severity} instead of ${parsed.severity}: ${challenge.note} - flagged for human review.`;
  }

  // Wonder plans the response for critical incidents.
  let plan = parsed.plan;
  if (parsed.severity === "blocker") {
    try {
      const deep = await chat(
        [
          {
            role: "system",
            content:
              "You are an incident commander. Given the verdict, reply with exactly:\nFIXPLAN: <ordered response steps separated by semicolons>",
          },
          { role: "user", content: `Verdict: ${parsed.verdict}\nSummary: ${parsed.summary}` },
        ],
        { model: modelId("wonder"), maxTokens: 1200, fetchImpl },
      );
      const steps = deep.match(/^FIXPLAN:\s*(.+)$/m)?.[1]?.split(";").map((s) => s.trim()).filter(Boolean);
      if (steps && steps.length > 0) plan = steps;
    } catch (e) {
      console.warn(`[guardian] Wonder planning skipped: ${(e as Error).message}`);
    }
  }
  return { ...parsed, plan, disagreement, glimmerFiltered: filtered };
}

export interface SimAction {
  id: string;
  action: "block_ip" | "revoke_sessions" | "rate_limit";
  target: string;
  status: "simulated-contained";
  detail: string;
  at: string;
}

/** Execute a response action against the SIMULATED environment. Pure + instant. */
export function simulateResponse(action: SimAction["action"], target: string): SimAction {
  const detail =
    action === "block_ip"
      ? `Simulated firewall deny for ${target}: attack traffic from this source drops to zero in the next window.`
      : action === "revoke_sessions"
        ? `Simulated session revocation for ${target}: all active tokens invalidated, re-authentication required.`
        : `Simulated rate limit on ${target}: 10 requests/minute cap applied to sensitive endpoints.`;
  return { id: `act_${Date.now().toString(36)}`, action, target, status: "simulated-contained", detail, at: new Date().toISOString() };
}

export interface Containment {
  contained: boolean;
  before: number;
  after: number;
  detail: string;
}

/**
 * Verify containment honestly: compare suspicious-event counts between the
 * pre-action baseline and a fresh post-action window.
 */
export function verifyContainment(baselineSuspicious: number, afterEvents: GuardEvent[]): Containment {
  const after = afterEvents.filter((e) => e.outcome === "failure" || e.outcome === "deny").length;
  const contained = baselineSuspicious > 0 && after <= baselineSuspicious * 0.2;
  return {
    contained,
    before: baselineSuspicious,
    after,
    detail: contained
      ? `Suspicious events fell from ${baselineSuspicious} to ${after}: attack contained (simulated).`
      : `Suspicious events at ${after} vs baseline ${baselineSuspicious}: NOT contained, escalate.`,
  };
}
