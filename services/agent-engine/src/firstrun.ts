// First run experience: what a new user hits in the first minute.
// Rendered checks via Playwright; pure grading so tests run offline.

import { chromium } from "playwright";
import type { SnapBrowser, SnapPage } from "./a11y.js";

export interface FirstRunPage extends SnapPage {
  setViewportSize(v: { width: number; height: number }): Promise<void>;
  reload(opts?: Record<string, unknown>): Promise<unknown>;
  on(event: string, cb: (msg: { text(): string; type(): string }) => void): void;
}

export interface FirstRunSnapshot {
  reachable: boolean;
  loadMs: number;
  heroText: string | null;
  primaryCta: string | null;
  consoleErrors: string[];
  mobileOverflow: boolean;
  mobileCtaVisible: boolean;
  authReachable: boolean;
}

export interface FirstRunStep {
  id: string;
  name: string;
  pass: boolean;
  evidence: string;
}

export interface FirstRunReport {
  id: string;
  at: string;
  targetUrl: string;
  steps: FirstRunStep[];
  passed: number;
  failed: number;
  score: number;
  /** Who executed this run, shown to the user right after the scan. */
  executor: string;
}

function scrapeDesktop(): { heroText: string | null; primaryCta: string | null; authReachable: boolean } {
  const h1 = document.querySelector("h1")?.textContent?.trim() ?? null;
  const hero = document.querySelector("main p, header p")?.textContent?.trim() ?? null;
  const ctaRe = /sign up|get started|start free|try free|try it|join|create account|start now/i;
  let cta: string | null = null;
  for (const el of Array.from(document.querySelectorAll("a, button"))) {
    const t = (el.textContent ?? "").trim();
    if (t.length > 0 && t.length < 60 && ctaRe.test(t)) { cta = t; break; }
  }
  if (!cta) {
    const first = Array.from(document.querySelectorAll("main a, header a")).map((a) => (a.textContent ?? "").trim()).find((t) => t.length > 0 && t.length < 40) ?? null;
    cta = first;
  }
  const authRe = /log in|login|sign in|signin|sign up|signup/i;
  const authReachable = Array.from(document.querySelectorAll("a, button")).some((el) => authRe.test((el.textContent ?? "").trim()));
  return { heroText: h1 ?? hero, primaryCta: cta, authReachable };
}

function scrapeMobile(): { overflow: boolean; ctaVisible: boolean } {
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  const ctaRe = /sign up|get started|start free|try free|try it|join|create account|start now/i;
  let visible = false;
  for (const el of Array.from(document.querySelectorAll("a, button"))) {
    const t = (el.textContent ?? "").trim();
    if (!ctaRe.test(t)) continue;
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width > 0 && r.height > 0) { visible = true; break; }
  }
  return { overflow, ctaVisible: visible };
}

/** Pure grading over a snapshot: deterministic, no browser needed. */
export function gradeFirstRunSnapshot(targetUrl: string, snap: FirstRunSnapshot): FirstRunReport {
  const steps: FirstRunStep[] = [];
  steps.push({
    id: "F1-loads-fast", name: "Page loads for a new visitor", pass: snap.reachable && snap.loadMs < 8000,
    evidence: !snap.reachable ? "page did not load" : `loaded in ${(snap.loadMs / 1000).toFixed(1)}s (budget 8s)`,
  });
  const heroLen = (snap.heroText ?? "").trim().length;
  steps.push({
    id: "F2-hero-clear", name: "Headline explains the product", pass: heroLen >= 20,
    evidence: snap.heroText ? `"${snap.heroText.slice(0, 90)}"` : "no h1 or hero copy found",
  });
  steps.push({
    id: "F3-primary-cta", name: "One clear next step (CTA)", pass: !!snap.primaryCta,
    evidence: snap.primaryCta ? `CTA: "${snap.primaryCta}"` : "no signup/start call to action found",
  });
  steps.push({
    id: "F4-no-errors", name: "No console errors on load", pass: snap.consoleErrors.length === 0,
    evidence: snap.consoleErrors.length === 0 ? "console clean" : `${snap.consoleErrors.length} error(s): ${snap.consoleErrors.slice(0, 2).join(" | ").slice(0, 200)}`,
  });
  steps.push({
    id: "F5-mobile-ok", name: "Mobile layout holds (390px)", pass: !snap.mobileOverflow && snap.mobileCtaVisible,
    evidence: snap.mobileOverflow ? "horizontal overflow at 390px" : snap.mobileCtaVisible ? "fits, CTA visible" : "fits, but CTA not visible",
  });
  steps.push({
    id: "F6-auth-reachable", name: "Sign in / sign up reachable", pass: snap.authReachable,
    evidence: snap.authReachable ? "auth entry point found" : "no login/signup entry found",
  });
  const passed = steps.filter((s) => s.pass).length;
  return {
    id: `fr_${Date.now().toString(36)}`, at: new Date().toISOString(), targetUrl,
    steps, passed, failed: steps.length - passed, score: Math.round((passed / steps.length) * 100),
    executor: "Charie engine - Playwright first-visit checks (deterministic, no AI grading)",
  };
}

/** Collect a snapshot with any browser (real Chromium or a stub). */
export async function collectFirstRunSnapshot(
  targetUrl: string,
  launch: () => Promise<SnapBrowser> = () => chromium.launch() as unknown as Promise<SnapBrowser>,
): Promise<FirstRunSnapshot> {
  const browser = await launch();
  try {
    const page = (await browser.newPage({ viewport: { width: 1280, height: 800 } })) as FirstRunPage;
    const errors: string[] = [];
    try {
      page.on("console", (msg) => {
        try {
          if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
        } catch {
          /* ignore listener faults */
        }
      });
      const t0 = Date.now();
      let reachable = true;
      try {
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
      } catch {
        reachable = false;
      }
      const loadMs = Date.now() - t0;
      const desk = reachable ? await page.evaluate(scrapeDesktop) : { heroText: null, primaryCta: null, authReachable: false };
      let mobileOverflow = false;
      let mobileCtaVisible = false;
      if (reachable) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload({ waitUntil: "networkidle", timeout: 45000 }).catch(() => null);
        const mob = await page.evaluate(scrapeMobile);
        mobileOverflow = mob.overflow;
        mobileCtaVisible = mob.ctaVisible;
      }
      return { reachable, loadMs, ...desk, consoleErrors: errors.slice(0, 10), mobileOverflow, mobileCtaVisible, authReachable: desk.authReachable };
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

/** Full run: snapshot the live page, grade it. */
export async function runFirstRun(
  targetUrl: string,
  opts: { launch?: () => Promise<SnapBrowser> } = {},
): Promise<FirstRunReport> {
  const snap = await collectFirstRunSnapshot(targetUrl, opts.launch);
  return gradeFirstRunSnapshot(targetUrl, snap);
}
