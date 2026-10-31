// Accessibility checks against a live page: rendered DOM snapshot via
// Playwright, graded by pure rules so tests run without a browser.

import { chromium } from "playwright";

/** Minimal page face: real Playwright pages and test stubs both fit. */
export interface SnapPage {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
}

export interface SnapBrowser {
  newPage(opts?: Record<string, unknown>): Promise<SnapPage>;
  close(): Promise<void>;
}

export interface A11ySnapshot {
  lang: string | null;
  title: string;
  viewport: string | null;
  images: Array<{ src: string; alt: string | null }>;
  inputs: Array<{ kind: string; labelled: boolean }>;
  buttons: Array<{ named: boolean }>;
  headings: Array<{ level: number; text: string }>;
  tabindexNegative: number;
  minContrast: number | null;
}

export interface A11yCheck {
  id: string;
  name: string;
  severity: "blocker" | "major" | "minor";
  pass: boolean;
  evidence: string;
}

export interface A11yReport {
  id: string;
  at: string;
  targetUrl: string;
  checks: A11yCheck[];
  passed: number;
  failed: number;
  grade: "A" | "B" | "C" | "D" | "F";
}

function gradeOf(failedBlocker: number, failedMajor: number, failedMinor: number): A11yReport["grade"] {
  if (failedBlocker > 0) return "F";
  if (failedMajor >= 3) return "D";
  if (failedMajor >= 1) return "C";
  if (failedMinor >= 3) return "B";
  return "A";
}

/** Pure grading over a snapshot: deterministic, no browser needed. */
export function gradeA11ySnapshot(targetUrl: string, snap: A11ySnapshot): A11yReport {
  const checks: A11yCheck[] = [];
  const missingAlt = snap.images.filter((i) => i.alt === null || i.alt.trim() === "");
  checks.push({
    id: "A1-images-alt", name: "Informative images have alt text", severity: "major",
    pass: missingAlt.length === 0,
    evidence: missingAlt.length === 0 ? `${snap.images.length} image(s), all labelled` : `${missingAlt.length} of ${snap.images.length} images missing alt: ${missingAlt.slice(0, 3).map((i) => i.src).join(", ")}`,
  });
  const unlabelled = snap.inputs.filter((i) => !i.labelled);
  checks.push({
    id: "A2-input-labels", name: "Form fields have labels", severity: "blocker",
    pass: unlabelled.length === 0,
    evidence: unlabelled.length === 0 ? `${snap.inputs.length} field(s), all labelled` : `${unlabelled.length} of ${snap.inputs.length} fields unlabelled (${unlabelled.slice(0, 3).map((i) => i.kind).join(", ")})`,
  });
  const unnamed = snap.buttons.filter((b) => !b.named);
  checks.push({
    id: "A3-button-names", name: "Buttons have accessible names", severity: "blocker",
    pass: unnamed.length === 0,
    evidence: unnamed.length === 0 ? `${snap.buttons.length} button(s)/link(s), all named` : `${unnamed.length} of ${snap.buttons.length} unnamed`,
  });
  const h1 = snap.headings.filter((h) => h.level === 1);
  let orderOk = true;
  for (let i = 1; i < snap.headings.length; i++) {
    if (snap.headings[i].level - snap.headings[i - 1].level > 1) { orderOk = false; break; }
  }
  checks.push({
    id: "A4-headings", name: "One h1, logical heading order", severity: "minor",
    pass: h1.length === 1 && orderOk,
    evidence: h1.length !== 1 ? `found ${h1.length} h1 elements, want exactly 1` : orderOk ? `${snap.headings.length} heading(s) in order` : "heading levels skip (e.g. h1 then h3)",
  });
  checks.push({
    id: "A5-page-lang", name: "Page declares a language", severity: "minor",
    pass: !!snap.lang,
    evidence: snap.lang ? `lang="${snap.lang}"` : "missing <html lang>",
  });
  checks.push({
    id: "A6-title-viewport", name: "Title and mobile viewport set", severity: "minor",
    pass: snap.title.trim().length > 0 && !!snap.viewport,
    evidence: `title=${snap.title.trim().length > 0 ? "yes" : "no"} viewport=${snap.viewport ? "yes" : "no"}`,
  });
  checks.push({
    id: "A7-keyboard", name: "Interactive elements stay keyboard reachable", severity: "major",
    pass: snap.tabindexNegative === 0,
    evidence: snap.tabindexNegative === 0 ? "no tabindex=-1 on controls" : `${snap.tabindexNegative} control(s) removed from tab order`,
  });
  const c = snap.minContrast;
  checks.push({
    id: "A8-contrast", name: "Body text contrast meets 4.5:1", severity: "major",
    pass: c !== null && c >= 4.5,
    evidence: c === null ? "no text sampled" : `min sampled ratio ${c.toFixed(2)}:1`,
  });
  const passed = checks.filter((ch) => ch.pass).length;
  return {
    id: `a11y_${Date.now().toString(36)}`, at: new Date().toISOString(), targetUrl,
    checks, passed, failed: checks.length - passed,
    grade: gradeOf(
      checks.filter((ch) => !ch.pass && ch.severity === "blocker").length,
      checks.filter((ch) => !ch.pass && ch.severity === "major").length,
      checks.filter((ch) => !ch.pass && ch.severity === "minor").length,
    ),
  };
}

/** DOM scrape: runs inside the browser, must stay self contained. */
function scrapeA11y(): A11ySnapshot {
  const doc = document;
  const lum = (rgb: number[]): number => {
    const f = (v: number): number => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  const ratio = (fg: number[], bg: number[]): number => {
    const a = lum(fg) + 0.05;
    const b = lum(bg) + 0.05;
    return a > b ? a / b : b / a;
  };
  const parse = (c: string): number[] | null => {
    const m = c.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  };
  const samples = [doc.body, ...Array.from(doc.querySelectorAll("p, li, a, span")).slice(0, 8)];
  let min: number | null = null;
  for (const el of samples) {
    if (!el || !el.textContent || el.textContent.trim().length === 0) continue;
    const st = getComputedStyle(el);
    const fg = parse(st.color);
    let bg = parse(st.backgroundColor);
    let node: HTMLElement | null = el as HTMLElement;
    while (bg && bg[3] === 0 && node.parentElement) {
      node = node.parentElement;
      bg = parse(getComputedStyle(node).backgroundColor);
    }
    if (fg && bg) {
      const r = ratio(fg, bg.slice(0, 3));
      if (min === null || r < min) min = Math.round(r * 100) / 100;
    }
  }
  const labelled = (el: Element): boolean => {
    if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return true;
    const id = el.getAttribute("id");
    if (id && doc.querySelector(`label[for="${id}"]`)) return true;
    return !!el.closest("label");
  };
  return {
    lang: doc.documentElement.getAttribute("lang"),
    title: doc.title ?? "",
    viewport: doc.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null,
    images: Array.from(doc.querySelectorAll("img")).slice(0, 50).map((img) => ({
      src: (img.getAttribute("src") ?? "").slice(0, 120), alt: img.getAttribute("alt"),
    })),
    inputs: Array.from(doc.querySelectorAll("input, select, textarea")).slice(0, 100).map((el) => ({
      kind: `${el.tagName.toLowerCase()}[type=${el.getAttribute("type") ?? "text"}]`, labelled: labelled(el),
    })),
    buttons: Array.from(doc.querySelectorAll("button, a")).slice(0, 100).map((el) => ({
      named: (el.textContent ?? "").trim().length > 0 || !!el.getAttribute("aria-label") || !!el.getAttribute("title"),
    })),
    headings: Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6")).slice(0, 60).map((el) => ({
      level: Number(el.tagName.slice(1)), text: (el.textContent ?? "").trim().slice(0, 120),
    })),
    tabindexNegative: doc.querySelectorAll("button[tabindex='-1'], a[tabindex='-1'], input[tabindex='-1'], select[tabindex='-1'], textarea[tabindex='-1']").length,
    minContrast: min,
  };
}

/** Collect a snapshot with any SnapBrowser (real Chromium or a stub). */
export async function collectA11ySnapshot(
  targetUrl: string,
  launch: () => Promise<SnapBrowser> = () => chromium.launch() as unknown as Promise<SnapBrowser>,
): Promise<A11ySnapshot> {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
      return await page.evaluate(scrapeA11y);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

/** Full run: snapshot the live page, grade it. */
export async function runA11y(
  targetUrl: string,
  opts: { launch?: () => Promise<SnapBrowser> } = {},
): Promise<A11yReport> {
  const snap = await collectA11ySnapshot(targetUrl, opts.launch);
  return gradeA11ySnapshot(targetUrl, snap);
}
