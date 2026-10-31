// Evidence analyst: turns a journey trace into typed findings.
// Deterministic rules v0 (stable IDs for before/after diffing); Muse Spark
// optionally enriches cause/fix prose when META_API_KEY is set.

import { enrichFinding, hasMetaKey } from "./meta-client.js";
import type { ConfusionSignal, Finding, JourneyTrace } from "./types.js";

function signalsOf(trace: JourneyTrace, signal: ConfusionSignal["signal"]): ConfusionSignal[] {
  return trace.confusionSignals.filter((s) => s.signal === signal);
}

function shots(trace: JourneyTrace, slug: string): string[] {
  return trace.actions.map((a) => a.screenshot).filter((s): s is string => !!s && s.includes(slug));
}

function allShots(trace: JourneyTrace): string[] {
  return trace.actions.map((a) => a.screenshot).filter((s): s is string => !!s);
}

export async function analyze(trace: JourneyTrace): Promise<Finding[]> {
  const findings: Finding[] = [];
  const logs = trace.events.map((e) => `[${e.kind}] ${e.detail}`);

  // BUG-1: checkout fails for 3+ items.
  const checkoutErr = trace.events.find((e) => e.kind === "response-error" && e.detail.includes("/api/checkout"));
  if (!trace.success && checkoutErr) {
    findings.push({
      id: "functional-checkout-3-items",
      category: "functional",
      severity: "blocker",
      title: "Place order silently fails with 3+ items in cart",
      goal: trace.goal,
      reproSteps: [
        "Add 3 different travel passes to the cart",
        "Open checkout, enter a valid email and name, click Continue",
        "Enter card details and click Place order (twice)",
        `Observe: no confirmation, no error message; ${checkoutErr.detail}`,
      ],
      evidence: { screenshots: shots(trace, "order-failed"), trace: "trace.json", logs },
      suspectedCause: "Checkout API returns 500 for 3+ items (ORDER_SPLIT_FAILED) and the client swallows the failure - spinner hides with no toast or redirect.",
      confidence: "high",
      suggestedFix:
        "Server: make POST /api/checkout handle multi-item carts (fix order splitting for 3+ items). Client: in checkout.html place-order handler, show an error toast on non-OK responses instead of failing silently.",
      regressionCheck: "Re-run this journey: order must reach /success and no 500 on /api/checkout.",
      status: "open",
      analysisSource: "heuristic",
    });
  }

  // UX-1: identical "Continue" labels, different behaviors.
  const ambiguous = signalsOf(trace, "ambiguous-controls");
  const backtrack = signalsOf(trace, "backtrack");
  if (ambiguous.length > 0 || backtrack.length > 0) {
    findings.push({
      id: "usability-continue-confusion",
      category: "usability",
      severity: "major",
      title: 'Multiple "Continue" controls do different things; users backtrack',
      goal: trace.goal,
      reproSteps: [
        "Reach checkout step 2 (payment)",
        `Observe ${ambiguous[0]?.detail ?? "several identically labeled controls"}`,
        'Click "Continue" on the payment step',
        "Observe: user is sent BACK to step 1 instead of forward",
      ],
      evidence: { screenshots: shots(trace, "checkout-step2"), trace: "trace.json", logs: backtrack.map((b) => b.detail) },
      suspectedCause:
        "Three controls share the label 'Continue' but trigger forward / backward / scroll-to-top behaviors; the payment-step button is mislabeled.",
      confidence: "high",
      suggestedFix:
        "Relabel by intent: step-1 button 'Continue to payment', payment-step back button 'Back to details', newsletter button 'Subscribe'. Add a visible step indicator of progress.",
      regressionCheck: "Re-run naive-user detour: no two primary controls share a label; clicking Back never advances.",
      status: "open",
      analysisSource: "heuristic",
    });
  }

  // UX-2: invalid email is a silent no-op.
  const silent = signalsOf(trace, "silent-noop");
  if (silent.length > 0) {
    findings.push({
      id: "usability-silent-email",
      category: "usability",
      severity: "minor",
      title: "Invalid email blocks progress with no error message",
      goal: trace.goal,
      reproSteps: [
        "Open checkout, enter 'not-an-email' and a name",
        "Click Continue",
        "Observe: nothing happens - no message, no advance",
      ],
      evidence: { screenshots: shots(trace, "checkout-step1"), trace: "trace.json", logs: silent.map((s) => s.detail) },
      suspectedCause: "Step-1 validation returns early without rendering feedback.",
      confidence: "high",
      suggestedFix: "Show an inline error ('Enter a valid email to continue.') and move focus to the email field.",
      regressionCheck: "Invalid email shows an error; valid email advances to step 2.",
      status: "open",
      analysisSource: "heuristic",
    });
  }

  // A11Y-1: place-order not keyboard reachable.
  const kb = signalsOf(trace, "keyboard-trap");
  if (kb.length > 0) {
    findings.push({
      id: "accessibility-place-order-keyboard",
      category: "accessibility",
      severity: "major",
      title: '"Place order" control is unreachable by keyboard',
      goal: trace.goal,
      reproSteps: [
        "Reach checkout step 2 with keyboard only",
        "Press Tab 15 times from the card field",
        "Observe: focus never lands on 'Place order' (it is a <div>, not a button)",
      ],
      evidence: { screenshots: allShots(trace).slice(-2), trace: "trace.json", logs: kb.map((s) => s.detail) },
      suspectedCause: "Place-order is a <div> with a click handler: no tabindex, no role, no key handling. Inputs also lack real <label>s.",
      confidence: "high",
      suggestedFix:
        "Replace the div with <button type=submit>; associate each input with a <label>; verify full checkout is completable with keyboard only.",
      regressionCheck: "Tab order reaches Place order; Enter/Space submits; a keyboard-only run completes checkout.",
      status: "open",
      analysisSource: "heuristic",
    });
  }

  // SEC-1: passive surface signals (headers / cookies). Labeled honestly.
  const surface = trace.events.filter((e) => e.kind === "signal" && e.detail.startsWith("surface:"));
  if (surface.length > 0) {
    findings.push({
      id: "security-headers-surface",
      category: "security",
      severity: "minor",
      title: "Missing security headers/cookie flags (surface check - not a pentest)",
      goal: trace.goal,
      reproSteps: [
        "Open the app in a browser",
        "Inspect the document response headers",
        `Observe: ${surface.map((s) => s.detail.replace(/^surface: /, "")).join("; ")}`,
      ],
      evidence: { screenshots: allShots(trace).slice(0, 1), trace: "trace.json", logs: surface.map((s) => s.detail) },
      suspectedCause: "Server does not set standard hardening headers / cookie flags.",
      confidence: "high",
      suggestedFix:
        "Set Content-Security-Policy, X-Frame-Options (or CSP frame-ancestors), X-Content-Type-Options, Referrer-Policy (and HSTS on HTTPS); add SameSite (+Secure on HTTPS) to cookies. Use your framework's helper (e.g. helmet for Express).",
      regressionCheck: "Document response carries all listed headers; cookies carry the flags.",
      status: "open",
      analysisSource: "heuristic",
    });
  }

  // A11Y-2: unlabeled inputs / missing alt text from the DOM scan.
  const domA11y = trace.events.filter((e) => e.kind === "signal" && e.detail.startsWith("a11y:"));
  if (domA11y.length > 0) {
    findings.push({
      id: "accessibility-missing-labels",
      category: "accessibility",
      severity: "minor",
      title: "Form controls and images missing accessible names",
      goal: trace.goal,
      reproSteps: [
        "Reach the checkout form",
        "Run a label/alt audit over inputs and images",
        `Observe: ${domA11y.map((s) => s.detail.replace(/^a11y: /, "")).join("; ")}`,
      ],
      evidence: { screenshots: shots(trace, "checkout"), trace: "trace.json", logs: domA11y.map((s) => s.detail) },
      suspectedCause: "Placeholder-only inputs with no <label>/aria-label; decorative or bare <img> without alt.",
      confidence: "high",
      suggestedFix: "Associate every input with a <label> (or aria-label); give informative images alt text and decorative ones alt=\"\".",
      regressionCheck: "Label/alt audit reports zero unnamed controls.",
      status: "open",
      analysisSource: "heuristic",
    });
  }

  // Optional Muse Spark enrichment (cause/fix prose only - IDs and verdicts stay deterministic).
  if (hasMetaKey() && findings.length > 0) {
    console.log("[analyst] META_API_KEY found - enriching with Muse Spark…");
    await Promise.all(
      findings.map(async (f) => {
        const enriched = await enrichFinding({
          title: f.title,
          category: f.category,
          reproSteps: f.reproSteps,
          signals: f.evidence.logs.slice(0, 5),
        });
        if (enriched) {
          f.suspectedCause = enriched.suspectedCause;
          f.suggestedFix = enriched.suggestedFix;
          f.analysisSource = "muse-spark";
        }
      }),
    );
  } else {
    console.log("[analyst] heuristic mode (set META_API_KEY for Muse Spark enrichment)");
  }

  return findings;
}
