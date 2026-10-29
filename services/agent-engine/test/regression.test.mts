// Committed regression tests (offline, no browser/server). Run: npm run test.
// Covers: run-dir naming contract (portal/engine must agree verbatim),
// analyst finding coverage incl. surface checks, triage + redesign basics,
// secrets resolution (env fast path, GCP fail-soft, confirmed model IDs).
import { strict as assert } from "node:assert";
import { analyze } from "../src/analyst.js";
import { hasMetaKey, modelId } from "../src/meta-client.js";
import { briefFor } from "../src/redesign.js";
import { runDirName } from "../src/run-id.js";
import { _clearSecretCache, loadSecrets, secret } from "../src/secrets.js";
import { checkHeaders } from "../src/surface.js";
import { extractGoal, preGrade } from "../src/triage.js";
import type { JourneyTrace } from "../src/types.js";

let n = 0;
const ok = (cond: unknown, msg: string) => { n++; assert.ok(cond, msg); };

// 1. Run-dir contract: GHOSTQA_RUN_ID wins verbatim, else stamp rules.
process.env.GHOSTQA_RUN_ID = "portal-predicted-id";
ok(runDirName("S", false) === "portal-predicted-id", "env id used verbatim (investigate)");
ok(runDirName("S", true) === "portal-predicted-id", "env id used verbatim (verify)");
delete process.env.GHOSTQA_RUN_ID;
ok(runDirName("S", false) === "S", "investigate stamp default");
ok(runDirName("S", true) === "S-verify", "verify stamp default");

// 2. Triage basics.
const goal = extractGoal("Checkout button does nothing", "Customer tried 3 times. Gave up.");
ok(goal === "Checkout button does nothing", `goal extraction, got: ${goal}`);
ok(extractGoal("a".repeat(200), "").length <= 140, "goal capped at 140");
ok(preGrade("checkout broken", "") === "blocker", "blocker pre-grade");
ok(preGrade("Typo in footer", "small text") === "minor", "minor pre-grade");

// 3. Surface header checks.
const empty = checkHeaders({}, false);
ok(empty.missing.includes("content-security-policy"), "missing csp flagged");
ok(empty.missing.includes("x-frame-options"), "missing x-frame flagged");
ok(!empty.missing.includes("strict-transport-security"), "no hsts demand on http");
ok(checkHeaders({}, true).missing.includes("strict-transport-security"), "hsts demanded on https");
ok(checkHeaders({
  "content-security-policy": "default-src 'self' frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
}, false).missing.length === 0, "hardened headers pass (frame-ancestors covers x-frame)");
const cookies = checkHeaders({ "set-cookie": "sid=abc; Path=/" }, false);
ok(cookies.weakCookies.length === 1 && cookies.weakCookies[0].startsWith("sid"), "weak cookie flagged");

// 4. Analyst: full-signal trace yields all 6 findings with stable IDs.
const trace: JourneyTrace = {
  goal, targetUrl: "http://localhost:3101", build: "buggy",
  startedAt: "", finishedAt: "", success: false,
  actions: [
    { t: 1, action: "a", ok: true, screenshot: "step-01-home.png" },
    { t: 2, action: "b", ok: false, screenshot: "step-05-order-failed.png" },
  ],
  events: [
    { t: 2, kind: "response-error", detail: "500 POST http://localhost:3101/api/checkout" },
    { t: 3, kind: "signal", detail: "surface: missing security headers: content-security-policy" },
    { t: 3, kind: "signal", detail: "a11y: 3 form inputs without accessible labels" },
  ],
  confusionSignals: [
    { step: "s1", signal: "silent-noop", detail: "x" },
    { step: "s2", signal: "ambiguous-controls", detail: "x" },
    { step: "s2", signal: "backtrack", detail: "x" },
    { step: "s2", signal: "keyboard-trap", detail: "x" },
    { step: "s3", signal: "reclick", detail: "x" },
  ],
};
const ids = (await analyze(trace)).map((f) => f.id);
for (const want of [
  "functional-checkout-3-items",
  "usability-continue-confusion",
  "usability-silent-email",
  "accessibility-place-order-keyboard",
  "security-headers-surface",
  "accessibility-missing-labels",
]) ok(ids.includes(want), `finding ${want} emitted`);
ok(ids.length === 6, `exactly 6 findings, got ${ids.length}`);

// 5. Redesign briefs only for usability findings.
const uf = (await analyze(trace)).find((f) => f.category === "usability")!;
ok(briefFor(uf)!.directions.length === 2, "usability brief has 2 directions");
const ff = (await analyze(trace)).find((f) => f.category === "functional")!;
ok(briefFor(ff) === null, "no brief for functional findings");

// 6. Secrets resolution (offline: GCP project cleared so no network happens).
const savedEnv: Record<string, string | undefined> = {};
for (const k of ["META_API_KEY", "META_SPARK_MODEL", "META_TEXT_MODEL", "META_WONDER_MODEL", "META_IMAGE_MODEL", "META_VOICE_MODEL", "META_SAM_MODEL", "GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT"]) {
  savedEnv[k] = process.env[k];
  delete process.env[k];
}
_clearSecretCache();
process.env.META_API_KEY = "test-key";
ok(secret("META_API_KEY") === "test-key", "secret() env fast path");
ok(hasMetaKey() === true, "hasMetaKey true from env");
delete process.env.META_API_KEY;
ok(secret("META_API_KEY") === undefined, "secret() undefined when unset");
ok(hasMetaKey() === false, "hasMetaKey false when unset");
const loadRes = await loadSecrets(["META_API_KEY", "META_SPARK_MODEL"]);
ok(loadRes.loaded.length === 0 && loadRes.missing.length === 2, "loadSecrets fails soft with no project");
for (const [kind, want] of [["spark", "muse-spark-1.3"], ["wonder", "muse-wonder-1.0"], ["image", "muse-image-1.0"], ["voice", "muse-voice-transcribe-1.0"], ["sam", "sam-3-1"]] as const) {
  ok(modelId(kind) === want, `confirmed default model id: ${kind}`);
}
process.env.META_WONDER_MODEL = "override-id";
ok(modelId("wonder") === "override-id", "model id env override wins");
for (const [k, v] of Object.entries(savedEnv)) {
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}
_clearSecretCache();

console.log(`REGRESSION PASS: ${n}/${n} assertions`);
