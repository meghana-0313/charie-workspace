import assert from "node:assert/strict";
import { deriveSignals, resolveLiveTarget, type LiveCheck } from "../lib/live-monitor.ts";

const check = (name: string, ok: boolean, status: number | null, ms = 40, detail = ""): LiveCheck => ({ name, ok, status, ms, detail });

// Target resolution: explicit env wins, then configured product, then demo defaults.
assert.equal(resolveLiveTarget({ envUrl: "https://app.example.com/", settingUrl: "https://other.example.com", demo: true, hosted: true }), "https://app.example.com");
assert.equal(resolveLiveTarget({ settingUrl: "https://app.example.com", demo: false, hosted: false }), "https://app.example.com");
assert.equal(resolveLiveTarget({ demo: true, hosted: true }), "https://charie-demo-ehfuotlisq-uc.a.run.app");
assert.equal(resolveLiveTarget({ demo: true, hosted: false }), "http://localhost:3101");

// The seeded checkout bug (HTTP 500 on a 3-item cart) is a critical live signal.
const buggy = deriveSignals([
  check("Home page", true, 200, 35),
  check("Products API", true, 200, 20),
  check("Build flavor", true, 200, 15, "buggy"),
  check("Checkout probe (3 items)", false, 500, 25),
]);
assert.ok(buggy.some((s) => s.level === "critical" && /checkout fails/i.test(s.text)), "buggy checkout surfaces as critical");
assert.ok(buggy.some((s) => s.level === "info" && /buggy build/.test(s.text)), "build flavor is reported");

// Fixed build: checkout passes, signal says so - the panel can never fake either state.
const fixed = deriveSignals([
  check("Home page", true, 200, 35),
  check("Products API", true, 200, 20),
  check("Build flavor", true, 200, 15, "fixed"),
  check("Checkout probe (3 items)", true, 200, 25),
]);
assert.ok(fixed.some((s) => s.level === "ok" && /checks out/.test(s.text)), "fixed checkout reads green");
assert.ok(!fixed.some((s) => s.level === "critical"), "no criticals on a healthy site");

// Unreachable site: one clear critical, no invented detail.
const down = deriveSignals([check("Home page", false, null, 2500)]);
assert.equal(down.length, 1);
assert.equal(down[0].level, "critical");
assert.match(down[0].text, /unreachable/i);

// Slow home page trips the watch line.
const slow = deriveSignals([check("Home page", true, 200, 1400), check("Checkout probe (3 items)", true, 200, 30)]);
assert.ok(slow.some((s) => s.level === "warn" && /slow/.test(s.text)), "slow home page warns");

console.log("live-monitor tests passed");
