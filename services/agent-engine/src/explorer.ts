// Explorer: drives the real app with Playwright toward the goal and records
// everything - actions, screenshots, console errors, failed requests - plus
// first-time-user confusion signals (heuristic v0; vision-driven sim later).

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { checkHeaders, scanDom } from "./surface.js";
import type { ConfusionSignal, JourneyTrace, TraceAction, TraceEvent } from "./types.js";

export const GOAL = "Buy 3 different travel passes and complete checkout without assistance";

export async function runJourney(targetUrl: string, outDir: string, goal: string = GOAL): Promise<JourneyTrace> {
  await mkdir(outDir, { recursive: true });
  const t0 = Date.now();
  const actions: TraceAction[] = [];
  const events: TraceEvent[] = [];
  const confusionSignals: ConfusionSignal[] = [];
  const since = () => Date.now() - t0;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  page.on("console", (m) => {
    if (m.type() === "error") events.push({ t: since(), kind: "console-error", detail: m.text() });
  });
  page.on("requestfailed", (r) =>
    events.push({ t: since(), kind: "request-failed", detail: `${r.method()} ${r.url()}` }),
  );
  let navHeaders: Record<string, string> = {};
  page.on("response", (r) => {
    void (async () => {
      if (r.request().isNavigationRequest() && r.url().startsWith(targetUrl)) {
        try {
          navHeaders = await r.allHeaders();
        } catch { /* ignore */ }
      }
    })();
    if (r.status() >= 400)
      events.push({ t: since(), kind: "response-error", detail: `${r.status()} ${r.request().method()} ${r.url()}` });
  });

  let shot = 0;
  async function snap(slug: string): Promise<string> {
    shot += 1;
    const name = `step-${String(shot).padStart(2, "0")}-${slug}.png`;
    await page.screenshot({ path: join(outDir, name) });
    return name;
  }
  function act(action: string, detail = "", ok = true, screenshot?: string) {
    actions.push({ t: since(), action, detail, screenshot, ok });
  }

  // Build label
  let build = "unknown";
  try {
    const r = await fetch(`${targetUrl}/api/build`);
    build = ((await r.json()) as { build: string }).build;
  } catch { /* keep unknown */ }

  // 1. Home → add 3 different products.
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  act("open store", targetUrl, true, await snap("home"));
  const viewLinks = page.locator('a:has-text("View")');
  for (let i = 0; i < 3; i++) {
    await viewLinks.nth(i).click();
    await page.waitForURL("**/product**");
    const name = (await page.locator("h2").textContent())?.trim() ?? `item ${i + 1}`;
    await page.locator("#add").click(); // lands on /cart
    await page.waitForURL("**/cart**");
    act("add to cart", name, true, i === 2 ? await snap("cart-3-items") : undefined);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  }

  // 2. Checkout step 1 - first with an INVALID email (UX-2 probe).
  await page.goto(`${targetUrl}/checkout`);
  await page.fill("#email", "not-an-email");
  await page.fill("#name", "Ada Tester");
  await page.locator("#continue-1").click();
  await page.waitForTimeout(400);
  const step2AfterBadEmail = await page.locator("#step2").isVisible();
  const toastAfterBadEmail = await page.locator("#toast").isVisible();
  if (!step2AfterBadEmail && !toastAfterBadEmail) {
    confusionSignals.push({
      step: "checkout step 1",
      signal: "silent-noop",
      detail: "Invalid email + Continue: nothing happened, no error message shown.",
    });
    events.push({ t: since(), kind: "signal", detail: "silent-noop on invalid email" });
  }
  act("fill details (invalid email probe)", "not-an-email", true, await snap("checkout-step1"));

  // 3. Valid email → step 2.
  await page.fill("#email", "ada@example.com");
  await page.locator("#continue-1").click();
  await page.waitForSelector("#step2:visible", { timeout: 3000 });
  act("fill details (valid)", "ada@example.com", true);

  // 4. Ambiguous "Continue" controls census (UX-1 evidence).
  const continues = await page.locator('button:has-text("Continue"), a:has-text("Continue")').all();
  const visibleContinues: string[] = [];
  for (const c of continues) if (await c.isVisible()) visibleContinues.push((await c.textContent())?.trim() ?? "");
  if (visibleContinues.length > 1) {
    confusionSignals.push({
      step: "checkout step 2",
      signal: "ambiguous-controls",
      detail: `${visibleContinues.length} visible controls labeled "Continue" with different behaviors.`,
    });
  }

  // 5. Keyboard reachability probe for place-order (A11Y-1 evidence).
  await page.locator("#card").click();
  let keyboardReached = false;
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => (document.activeElement as HTMLElement)?.id ?? "");
    if (id === "place-order") {
      keyboardReached = true;
      break;
    }
  }
  if (!keyboardReached) {
    confusionSignals.push({
      step: "checkout step 2",
      signal: "keyboard-trap",
      detail: "'Place order' control never received keyboard focus after 15 Tab presses (not a real button).",
    });
  }
  act("inspect payment step", `${visibleContinues.length}x "Continue" visible`, true, await snap("checkout-step2"));

  // 6. Naive-user detour: click a "Continue" expecting progress (UX-1 repro).
  await page.locator("#continue-2").click();
  await page.waitForTimeout(400);
  const backAtStep1 = await page.locator("#step1").isVisible();
  if (backAtStep1) {
    confusionSignals.push({
      step: "checkout step 2",
      signal: "backtrack",
      detail: 'Clicked "Continue" on the payment step and was sent BACK to step 1.',
    });
    events.push({ t: since(), kind: "signal", detail: "backtrack via #continue-2" });
  }
  act("click Continue on payment step (naive user)", backAtStep1 ? "sent back to step 1" : "stayed", true);
  // Recover: go forward again.
  await page.locator("#continue-1").click();
  await page.waitForSelector("#step2:visible", { timeout: 3000 });

  // 7. Place the order - twice, like a confused customer (BUG-1 repro + reclick).
  await page.fill("#card", "4242424242424242");
  await page.locator("#place-order").click();
  await page.waitForTimeout(1200);
  let success = page.url().includes("/success");
  if (!success) {
    await page.locator("#place-order").click(); // customer retries, nothing happens
    await page.waitForTimeout(1200);
    success = page.url().includes("/success");
    const checkout500 = events.some((e) => e.detail.includes("POST") && e.detail.includes("/api/checkout"));
    confusionSignals.push({
      step: "place order",
      signal: "reclick",
      detail: `Clicked "Place order" twice with no confirmation${checkout500 ? "; checkout API returned an error" : ""}.`,
    });
  }
  act("place order", success ? "order confirmed" : "FAILED: no confirmation", success, await snap(success ? "success" : "order-failed"));

  // 8. Passive surface checks (headers + DOM a11y signals).
  const { missing, weakCookies } = checkHeaders(navHeaders, targetUrl.startsWith("https:"));
  if (missing.length > 0) {
    events.push({ t: since(), kind: "signal", detail: `surface: missing security headers: ${missing.join(", ")}` });
  }
  for (const c of weakCookies) {
    events.push({ t: since(), kind: "signal", detail: `surface: weak cookie flags: ${c}` });
  }
  const dom = await scanDom(page);
  if (dom.unlabeledInputs > 0) {
    events.push({ t: since(), kind: "signal", detail: `a11y: ${dom.unlabeledInputs} form inputs without accessible labels` });
  }
  if (dom.imagesMissingAlt > 0) {
    events.push({ t: since(), kind: "signal", detail: `a11y: ${dom.imagesMissingAlt} images without alt text` });
  }
  act("surface checks", `${missing.length} missing headers, ${dom.unlabeledInputs} unlabeled inputs`, true);

  await browser.close();

  const trace: JourneyTrace = {
    goal,
    targetUrl,
    build,
    startedAt: new Date(t0).toISOString(),
    finishedAt: new Date().toISOString(),
    success,
    actions,
    events,
    confusionSignals,
  };
  await writeFile(join(outDir, "trace.json"), JSON.stringify(trace, null, 2));
  return trace;
}
