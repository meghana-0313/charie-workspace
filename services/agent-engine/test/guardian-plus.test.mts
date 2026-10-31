// Guardian suite tests (offline, stubbed fetch). Run: npm run test.
// Covers: work order transitions/risk/store, signal clustering/sentiment,
// sweep streaks, pentest suite with canned HTTP, night shift digest + run,
// zoom unconfigured behavior.
import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectSignals } from "../src/guardian.js";
import type { GuardEvent } from "../src/guardian.js";
import { runNightShift, digestMarkdown } from "../src/nightshift.js";
import { checkTlsPosture, runPentest } from "../src/pentest.js";
import type { TlsConnect } from "../src/pentest.js";
import { loadSweeps, passStreak, runSweep } from "../src/sweep.js";
import { clusterMessages, gradeMessage, keywordSentiment } from "../src/signals.js";
import {
  approveWorkOrder, canTransition, createWorkOrder, getWorkOrder, riskOf, updateWorkOrder,
} from "../src/workorders.js";
import { joinMeeting, zoomStatus } from "../src/zoom.js";

let n = 0;
const ok = (cond: unknown, msg: string) => { n++; assert.ok(cond, msg); };

// 1. Work order state machine.
ok(canTransition("proposed", "approved"), "proposed -> approved");
ok(!canTransition("proposed", "done"), "proposed cannot jump to done");
ok(canTransition("verifying", "rolledback"), "verifying -> rolledback");
ok(!canTransition("done", "proposed"), "done is terminal");
ok(riskOf([{ kind: "verify-fix", label: "v", ref: "t" }]) === "low", "verify-only is low risk");
ok(riskOf([]) === "high", "empty plan is high risk");

const root = mkdtempSync(join(tmpdir(), "wo-"));
const wo = createWorkOrder(root, {
  title: "Re-verify checkout", source: "guardian", sourceRef: "inc_1",
  plan: [{ kind: "verify-fix", label: "v", ref: "tkt_1" }],
});
ok(wo.status === "proposed" && wo.risk === "low", "created proposed/low");
ok(getWorkOrder(root, wo.id)?.id === wo.id, "roundtrip by id");
const appr = approveWorkOrder(root, wo.id, "meg");
ok(appr?.status === "approved" && appr.approvals.length === 1, "approve records approver");
let threw = false;
try {
  updateWorkOrder(root, wo.id, { status: "done" });
} catch {
  threw = true;
}
ok(threw, "illegal transition throws");
ok(updateWorkOrder(root, wo.id, { status: "scheduled" })?.status === "scheduled", "approved -> scheduled");

// 2. Signals: sentiment + clustering offline.
ok(keywordSentiment("this is ridiculous, refund now") === "angry", "angry keywords");
ok(keywordSentiment("thanks, great and easy") === "praise", "praise keywords");
ok(keywordSentiment("the pay button is stuck again") === "frustrated", "frustrated keywords");
const g = await gradeMessage({ id: "m", channel: "chat", author: "a", text: "refund now, terrible", ts: "" });
ok(g.sentiment === "angry", "offline grade falls back to keywords");
const clusters = clusterMessages([
  { id: "1", channel: "support", author: "a", text: "checkout failed twice, charged double", ts: "", sentiment: "angry" },
  { id: "2", channel: "chat", author: "b", text: "checkout charged me double, payment failed", ts: "", sentiment: "frustrated" },
  { id: "3", channel: "review", author: "c", text: "love the new pass picker, so fast", ts: "", sentiment: "praise" },
]);
ok(clusters.length === 2, `two themes cluster, got ${clusters.length}`);
ok(clusters[0].size === 2 && clusters[0].angryShare === 1, "hot cluster first with full angry share");

// 3. Sweep streaks.
ok(passStreak([]) === 0, "empty streak");
ok(passStreak([
  { id: "a", at: "", pass: true, checks: [] },
  { id: "b", at: "", pass: false, checks: [] },
  { id: "c", at: "", pass: true, checks: [] },
]) === 1, "streak counts trailing passes only");

// 4. Canned HTTP for pentest + sweep + night shift.
function canned(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Response {
  const u = new URL(url);
  const headers = new Map<string, string>();
  let status = 200;
  let body = "{}";
  const H = (k: string, v: string) => headers.set(k.toLowerCase(), v);
  if (u.hostname === "engine.test" && u.pathname === "/health") {
    body = '{"ok":true}';
  } else if (u.protocol === "http:" && u.hostname === "portal.test") {
    status = 301;
    H("location", url.replace("http:", "https:"));
  } else if (u.hostname === "engine.test" && (u.pathname === "/runs" || u.pathname.startsWith("/runs/"))) {
    const token = init?.headers?.["x-engine-token"];
    if (!token) {
      status = 401;
      body = '{"error":"bad or missing x-engine-token"}';
    } else if (u.pathname.includes("artifacts")) {
      status = 404;
      body = '{"error":"not found"}';
    } else if (init?.method === "POST") {
      status = 400;
      body = init.body === "{not json" ? '{"error":"invalid JSON body"}' : '{"error":"target blocked"}';
    }
  } else if (u.hostname === "portal.test" && u.pathname === "/") {
    H("content-security-policy", "default-src 'self'");
    H("x-frame-options", "DENY");
    H("x-content-type-options", "nosniff");
    H("referrer-policy", "no-referrer");
    H("strict-transport-security", "max-age=31536000");
    body = "<html></html>";
  } else if (u.hostname === "portal.test" && u.pathname === "/api/tickets") {
    body = "[]";
  } else if (u.hostname === "portal.test" && u.pathname === "/api/login") {
    status = 401;
    body = '{"error":"no"}';
  } else {
    status = 404;
  }
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}
const fetchImpl = (async (url: string, init?: unknown) =>
  canned(url, init as { method?: string; headers?: Record<string, string>; body?: string })) as unknown as typeof fetch;

const tlsStub: TlsConnect = () => ({
  once(ev: string, cb: () => void) {
    if (ev === "secureConnect") queueMicrotask(cb);
  },
  destroy() {},
  getProtocol: () => "TLSv1.3",
  getCipher: () => ({ name: "TLS_AES_256_GCM_SHA384" }),
  getPeerCertificate: () => ({
    valid_to: new Date(Date.now() + 90 * 86400000).toUTCString(),
    subject: { CN: "portal.test" },
  }),
});
const report = await runPentest(
  { portalUrl: "https://portal.test", engineUrl: "https://engine.test", engineToken: "tok" },
  fetchImpl,
  tlsStub,
);
ok(report.checks.length === 11, `11 appendix B checks, got ${report.checks.length}`);
ok(report.failed === 0 && report.grade === "A", `hardened target grades A, got ${report.grade}: ${report.checks.filter((c) => !c.pass).map((c) => c.id).join(",")}`);
const tlsWeak: TlsConnect = () => ({
  once(ev: string, cb: () => void) {
    if (ev === "secureConnect") queueMicrotask(cb);
  },
  destroy() {},
  getProtocol: () => "TLSv1",
  getCipher: () => ({ name: "DES-CBC3-SHA" }),
  getPeerCertificate: () => ({ valid_to: new Date(Date.now() + 86400000).toUTCString(), subject: {} }),
});
ok((await checkTlsPosture("https://portal.test", tlsWeak)).pass === false, "weak TLS posture fails");
ok((await checkTlsPosture("http://portal.test", tlsStub)).pass === false, "plain http fails posture");
ok((await checkTlsPosture("https://portal.test", null)).pass === true, "missing probe skips honestly");

// 4b. New detectors: privilege escalation + traffic spike.
const ev = (i: number, e: Partial<GuardEvent>): GuardEvent => ({
  id: `e${i}`, ts: new Date(Date.now() - i * 60000).toISOString(), kind: "api", ...e,
});
const privEsc = detectSignals([
  ev(0, { kind: "auth", outcome: "success", actor: "mallory" }),
  ev(1, { endpoint: "/admin/users", actor: "mallory", ip: "1.1.1.1" }),
  ev(2, { endpoint: "/admin/roles", actor: "mallory", ip: "1.1.1.1" }),
  ev(3, { endpoint: "/admin/permissions", actor: "mallory", ip: "1.1.1.1" }),
]);
ok(privEsc.some((s) => s.type === "privilege-escalation"), "privilege escalation detected");
const spikeEvents: GuardEvent[] = [];
for (let i = 0; i < 10; i++) {
  spikeEvents.push(ev(i, { ts: new Date(Date.now() - 3600000 + i * 60000).toISOString(), kind: "traffic", ip: "2.2.2.2" }));
}
for (let i = 0; i < 60; i++) {
  spikeEvents.push(ev(100 + i, { ts: new Date(Date.now() - 60000 + i * 500).toISOString(), kind: "traffic", ip: "3.3.3.3" }));
}
ok(detectSignals(spikeEvents).some((s) => s.type === "traffic-spike"), "traffic spike detected");
ok(!detectSignals([ev(0, { kind: "traffic" })]).some((s) => s.type === "traffic-spike"), "small windows never spike");

const sweepRoot = mkdtempSync(join(tmpdir(), "sw-"));
const sweep = await runSweep({ portalUrl: "https://portal.test", engineUrl: "https://engine.test" }, sweepRoot, fetchImpl);
ok(sweep.pass && sweep.checks.length === 4, "sweep passes hardened target");
ok(loadSweeps(sweepRoot).length === 1, "sweep persisted");

// 5. Night shift with no eligible orders: digest still ships with re-scan.
const shiftRoot = mkdtempSync(join(tmpdir(), "ns-"));
const shift = await runNightShift({
  dataRoot: shiftRoot,
  reportsRoot: mkdtempSync(join(tmpdir(), "rep-")),
  portalUrl: "https://portal.test",
  engineUrl: "https://engine.test",
  engineToken: "tok",
  claimHeavy: () => true,
  releaseHeavy: () => {},
  fetchImpl,
  tlsImpl: tlsStub,
});
ok(shift.orders.length === 0, "no eligible orders, none executed");
ok(shift.pentest?.grade === "A", "nightly re-scan included");
ok(shift.digest.includes("Night Shift digest"), "digest markdown built");
const { digest: _ignored, ...partial } = shift;
ok(digestMarkdown(partial).includes("grade A"), "digest helper renders grade");

// 6. Zoom without a key: honest unconfigured state, join refused.
const zs = await zoomStatus(fetchImpl);
ok(zs.configured === false && zs.setup.length > 0, "zoom reports setup steps without key");
let joinThrew = false;
try {
  await joinMeeting("https://zoom.us/j/123", fetchImpl);
} catch {
  joinThrew = true;
}
ok(joinThrew, "join refuses without RECALL_API_KEY");

console.log(`GUARDIAN SUITE PASS ${n}/${n}`);
