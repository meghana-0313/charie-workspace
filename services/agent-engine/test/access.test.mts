// Accessibility + first run checks (offline, stubbed browser). Run: npm run test.
import { strict as assert } from "node:assert";
import { gradeA11ySnapshot, runA11y } from "../src/a11y.js";
import type { A11ySnapshot, SnapBrowser } from "../src/a11y.js";
import { gradeFirstRunSnapshot, runFirstRun } from "../src/firstrun.js";
import type { FirstRunSnapshot } from "../src/firstrun.js";
import { groupEntries, runLogWatch } from "../src/logwatch.js";

let n = 0;
const ok = (cond: unknown, msg: string) => { n++; assert.ok(cond, msg); };

const goodA11y: A11ySnapshot = {
  lang: "en", title: "Shop", viewport: "width=device-width",
  images: [{ src: "a.png", alt: "logo" }],
  inputs: [{ kind: "input[type=text]", labelled: true }],
  buttons: [{ named: true }, { named: true }],
  headings: [{ level: 1, text: "Shop" }, { level: 2, text: "Deals" }],
  tabindexNegative: 0, minContrast: 7.2,
};
const r1 = gradeA11ySnapshot("https://x.test", goodA11y);
ok(r1.grade === "A" && r1.passed === 8 && r1.failed === 0, "clean page grades A 8/8");

const badA11y: A11ySnapshot = {
  lang: null, title: "", viewport: null,
  images: [{ src: "a.png", alt: null }, { src: "b.png", alt: "" }],
  inputs: [{ kind: "input[type=email]", labelled: false }],
  buttons: [{ named: false }],
  headings: [{ level: 1, text: "A" }, { level: 1, text: "B" }, { level: 3, text: "C" }],
  tabindexNegative: 2, minContrast: 2.1,
};
const r2 = gradeA11ySnapshot("https://x.test", badA11y);
ok(r2.grade === "F", "blockers fail the grade");
ok(r2.checks.find((c) => c.id === "A2-input-labels")?.pass === false, "unlabelled input fails A2");
ok(r2.checks.find((c) => c.id === "A8-contrast")?.pass === false, "2.1 contrast fails A8");
ok(r2.checks.find((c) => c.id === "A4-headings")?.pass === false, "double h1 fails A4");

const goodFr: FirstRunSnapshot = {
  reachable: true, loadMs: 1500, heroText: "Ship quality software with autonomous testing",
  primaryCta: "Get started", consoleErrors: [], mobileOverflow: false,
  mobileCtaVisible: true, authReachable: true,
};
const f1 = gradeFirstRunSnapshot("https://x.test", goodFr);
ok(f1.score === 100 && f1.passed === 6, "clean first run scores 100");

const badFr: FirstRunSnapshot = {
  reachable: true, loadMs: 12000, heroText: "Hi", primaryCta: null,
  consoleErrors: ["boom"], mobileOverflow: true, mobileCtaVisible: false, authReachable: false,
};
const f2 = gradeFirstRunSnapshot("https://x.test", badFr);
ok(f2.score === 0 && f2.failed === 6, "broken first run scores 0");

// Collector wiring with a stub browser (no Chromium needed).
let gotUrl = "";
const stubBrowser = (snaps: unknown[]): SnapBrowser => ({
  newPage: async () => {
    let i = 0;
    return {
      goto: async (url: string) => { gotUrl = url; return null; },
      evaluate: async <T,>() => snaps[Math.min(i++, snaps.length - 1)] as T,
      close: async () => {},
      setViewportSize: async () => {},
      reload: async () => null,
      on: () => {},
    };
  },
  close: async () => {},
});

const live1 = await runA11y("https://shop.test", { launch: async () => stubBrowser([goodA11y]) });
ok(live1.targetUrl === "https://shop.test" && gotUrl === "https://shop.test", "a11y drives the target URL");
ok(live1.grade === "A", "stubbed a11y run grades");

const live2 = await runFirstRun("https://shop.test", {
  launch: async () => stubBrowser([
    { heroText: goodFr.heroText, primaryCta: goodFr.primaryCta, authReachable: goodFr.authReachable },
    { overflow: goodFr.mobileOverflow, ctaVisible: goodFr.mobileCtaVisible },
  ]),
});
ok(live2.score === 100 && live2.steps.length === 6, "stubbed first run scores");

// Log watch grouping.
const grouped = groupEntries([
  { timestamp: "2026-01-01T00:00:00Z", severity: "ERROR", resource: { labels: { service_name: "api" } }, httpRequest: { status: 500 }, textPayload: "boom" },
  { timestamp: "2026-01-01T00:01:00Z", severity: "ERROR", resource: { labels: { service_name: "api" } }, httpRequest: { status: 500 }, textPayload: "boom again" },
  { timestamp: "2026-01-01T00:02:00Z", severity: "ERROR", resource: { labels: { service_name: "web" } }, textPayload: "disk full" },
]);
ok(grouped.length === 2, "two signatures grouped");
ok(grouped[0].count === 2 && grouped[0].service === "api", "5xx grouped by service+status");
ok(grouped[1].signature.includes("disk full"), "message head in signature");

// Log watch run with stubbed metadata + logging APIs.
const logStub = (async (url: string) => {
  if (String(url).includes("metadata.google.internal")) {
    return { ok: true, json: async () => ({ access_token: "tok" }) };
  }
  return {
    ok: true,
    json: async () => ({
      entries: [
        { timestamp: "2026-01-01T00:00:00Z", severity: "ERROR", resource: { labels: { service_name: "api" } }, httpRequest: { status: 503 }, textPayload: "upstream down" },
      ],
    }),
  };
}) as unknown as typeof fetch;
const lw = await runLogWatch("proj-test", { fetchImpl: logStub });
ok(lw.configured && lw.total === 1 && lw.groups[0].signature.includes("http-503"), "stubbed run reports");
const lwOff = await runLogWatch("proj-test", {
  fetchImpl: (async () => { throw new Error("no metadata"); }) as unknown as typeof fetch,
});
ok(!lwOff.configured && lwOff.groups.length === 0, "no GCP degrades honestly");

console.log(`access: ${n} assertions passed`);
