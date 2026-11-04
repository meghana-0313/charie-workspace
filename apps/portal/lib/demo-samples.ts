// Sample data for engine-backed surfaces in Demo Mode.
// A11y / first-run / pentest / Guardian reports live on the engine per
// account, not in the portal store, so the portal demo seed cannot reach
// them. When the demo account has no real reports, pages fall back to
// these samples instead of rendering empty. Every sample is labelled
// as sample data in its evidence text - never presented as a live scan.

import type {
  A11yView, BriefView, DigestView, FindingView, FirstRunView, LogWatchView,
  PentestView, SignalClusterView, SweepView, WorkOrderView, ZoomView,
} from "./types";

export const DEMO_SAMPLE_UID = "demo-workspace";

export function isDemoAccount(account?: string | null): boolean {
  return account === DEMO_SAMPLE_UID;
}

const SAMPLE = "Sample demo data - run a live scan to replace this with real results.";
/** The intentionally buggy demo site every sample scan targets. */
export const DEMO_TARGET_URL = process.env.DEMO_TARGET_URL ?? "http://localhost:3101";
export const DEMO_TARGET_NAME = "demo site (intentional bugs: checkout fails with 3+ items, keyboard and label defects, missing security headers)";
const TARGET = DEMO_TARGET_URL;

function at(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
}

export function sampleA11yReports(): A11yView[] {
  return [
    {
      id: "demo-a11y-2", at: at(1), targetUrl: TARGET, grade: "B", passed: 6, failed: 2, executor: "Sample demo data (seeded) - a live run is executed by the Charie engine in a real browser",
      checks: [
        { id: "img-alt", name: "Image alt text", severity: "major", pass: true, evidence: `${SAMPLE} All product images carry alt text.` },
        { id: "form-labels", name: "Form labels", severity: "blocker", pass: false, evidence: `${SAMPLE} Checkout email field has no associated label.` },
        { id: "button-names", name: "Button names", severity: "major", pass: true, evidence: `${SAMPLE} Icon buttons expose accessible names.` },
        { id: "headings", name: "Heading order", severity: "minor", pass: true, evidence: `${SAMPLE} Headings descend h1 to h3 without skips.` },
        { id: "lang", name: "Page language", severity: "minor", pass: true, evidence: `${SAMPLE} html lang="en" is set.` },
        { id: "keyboard", name: "Keyboard reach", severity: "blocker", pass: false, evidence: `${SAMPLE} Checkout button is not reachable by keyboard alone.` },
        { id: "contrast", name: "Text contrast", severity: "major", pass: true, evidence: `${SAMPLE} Body text measures 7.2:1 against its background.` },
        { id: "landmarks", name: "Landmarks", severity: "minor", pass: true, evidence: `${SAMPLE} main, nav and footer landmarks present.` },
      ],
    },
    {
      id: "demo-a11y-1", at: at(5), targetUrl: TARGET, grade: "C", passed: 5, failed: 3, executor: "Sample demo data (seeded) - a live run is executed by the Charie engine in a real browser",
      checks: [
        { id: "img-alt", name: "Image alt text", severity: "major", pass: false, evidence: `${SAMPLE} Two product images had empty alt text.` },
        { id: "form-labels", name: "Form labels", severity: "blocker", pass: false, evidence: `${SAMPLE} Email and password fields had no labels.` },
        { id: "keyboard", name: "Keyboard reach", severity: "blocker", pass: false, evidence: `${SAMPLE} Checkout button unreachable by keyboard.` },
        { id: "contrast", name: "Text contrast", severity: "major", pass: true, evidence: `${SAMPLE} Body text contrast passed.` },
      ],
    },
  ];
}

export function sampleFirstRunReports(): FirstRunView[] {
  return [
    {
      id: "demo-firstrun-2", at: at(1), targetUrl: TARGET, score: 82, passed: 5, failed: 1, executor: "Sample demo data (seeded) - a live run is executed by the Charie engine as a first-time visitor",
      steps: [
        { id: "loads", name: "Page loads", pass: true, evidence: `${SAMPLE} First paint in 1.1s on desktop.` },
        { id: "headline", name: "Headline explains the product", pass: true, evidence: `${SAMPLE} "Demo Site - groceries in minutes" names the offer.` },
        { id: "next-step", name: "One clear next step", pass: true, evidence: `${SAMPLE} Single primary "Start shopping" action.` },
        { id: "console", name: "Console health", pass: false, evidence: `${SAMPLE} One console error from the cart widget on first load.` },
        { id: "mobile", name: "Mobile layout", pass: true, evidence: `${SAMPLE} No horizontal scroll at 390px wide.` },
        { id: "signin", name: "Sign-in reachable", pass: true, evidence: `${SAMPLE} Sign-in is one tap from the header.` },
      ],
    },
    {
      id: "demo-firstrun-1", at: at(6), targetUrl: TARGET, score: 64, passed: 4, failed: 2, executor: "Sample demo data (seeded) - a live run is executed by the Charie engine as a first-time visitor",
      steps: [
        { id: "loads", name: "Page loads", pass: true, evidence: `${SAMPLE} First paint in 1.8s.` },
        { id: "headline", name: "Headline explains the product", pass: false, evidence: `${SAMPLE} Headline was a slogan with no product mention.` },
        { id: "next-step", name: "One clear next step", pass: false, evidence: `${SAMPLE} Three competing primary buttons.` },
        { id: "mobile", name: "Mobile layout", pass: true, evidence: `${SAMPLE} Layout held at mobile width.` },
      ],
    },
  ];
}

export function samplePentestReports(): PentestView[] {
  return [{
    id: "demo-pentest-1", at: at(2), targets: [TARGET], grade: "B", passed: 7, failed: 2, executor: "Sample demo data (seeded) - a live run is executed by the Charie engine security probes",
    checks: [
      { id: "tls", name: "TLS configuration", severity: "major", pass: true, evidence: `${SAMPLE} TLS 1.2+ only.` },
      { id: "headers", name: "Security headers", severity: "major", pass: false, evidence: `${SAMPLE} Content-Security-Policy header missing.` },
      { id: "cookies", name: "Cookie flags", severity: "major", pass: true, evidence: `${SAMPLE} Session cookie is HttpOnly and SameSite=Lax.` },
      { id: "xss", name: "Reflected XSS probes", severity: "blocker", pass: true, evidence: `${SAMPLE} Probe payloads were encoded on reflection.` },
      { id: "sqli", name: "SQL injection probes", severity: "blocker", pass: true, evidence: `${SAMPLE} Parameterised responses to all probes.` },
      { id: "auth", name: "Auth rate limiting", severity: "major", pass: false, evidence: `${SAMPLE} No throttling observed after 20 failed logins.` },
      { id: "disclosure", name: "Error disclosure", severity: "minor", pass: true, evidence: `${SAMPLE} Errors return generic messages.` },
      { id: "methods", name: "HTTP method restrictions", severity: "minor", pass: true, evidence: `${SAMPLE} Write methods rejected on read-only endpoints.` },
      { id: "cors", name: "CORS policy", severity: "major", pass: true, evidence: `${SAMPLE} No wildcard origin on authenticated routes.` },
    ],
    recon: { server: "sample (simulated)", poweredBy: "sample (simulated)", tech: ["Next.js (sample)"], endpoints: ["/", "/api/cart (sample)"] },
  }];
}

export function sampleSweeps(): SweepView[] {
  return [
    { id: "demo-sweep-2", at: at(1), pass: true, checks: [
      { name: "Portal health", pass: true, evidence: `${SAMPLE} Responded 200.` },
      { name: "Engine health", pass: true, evidence: `${SAMPLE} Responded 200.` },
    ] },
    { id: "demo-sweep-1", at: at(3), pass: false, checks: [
      { name: "Portal health", pass: true, evidence: `${SAMPLE} Responded 200.` },
      { name: "Engine health", pass: false, evidence: `${SAMPLE} Timed out once, recovered on retry.` },
    ] },
  ];
}

export function sampleWorkOrders(): WorkOrderView[] {
  return [
    {
      id: "demo-wo-checkout", title: "Verify the Demo Site checkout total fix", source: "ticket", sourceRef: "demo-tkt-checkout",
      status: "done", risk: "medium",
      plan: [
        { kind: "verify-fix", label: "Re-run the checkout journey", ref: "demo-run-shopflow-checkout", targetUrl: TARGET },
        { kind: "evidence-pack", label: "Attach before/after totals", ref: "demo-run-shopflow-checkout" },
      ],
      approvals: [{ by: "Demo Guest (sample)", at: at(2) }],
      proofs: [{ at: at(2), step: "verify-fix", ok: true, detail: `${SAMPLE} Cart and checkout totals matched at 2,499.` }],
      createdAt: at(3), updatedAt: at(2),
    },
    {
      id: "demo-wo-a11y", title: "Fix keyboard reachability of the checkout button", source: "ticket", sourceRef: "demo-tkt-a11y",
      status: "scheduled", risk: "low",
      plan: [
        { kind: "verify-fix", label: "Keyboard-only checkout pass", ref: "demo-tkt-a11y", targetUrl: TARGET },
        { kind: "docs-note", label: "Note the focus-order change", ref: "demo-tkt-a11y" },
      ],
      approvals: [], proofs: [], scheduledFor: at(-1), createdAt: at(2), updatedAt: at(2),
    },
  ];
}

export function sampleDigests(): DigestView[] {
  const orders = sampleWorkOrders();
  return [{
    id: "demo-digest-1", at: at(1), durationMs: 42000,
    orders: orders.map((o) => ({ id: o.id, title: o.title, status: o.status, proofs: o.proofs })),
    pentest: samplePentestReports()[0],
    digest: [
      "Night shift completed 2 work orders against the demo site.",
      "1. Checkout verification PASSED: cart and checkout totals matched at 2,499 after the coupon fix, with before/after proof attached to the ticket.",
      "2. Keyboard accessibility fix SCHEDULED for tonight: the checkout button becomes reachable in tab order, then gets a keyboard-only retest.",
      "Security re-scan finished at grade B: 7 of 9 checks passed. Still open: missing Content-Security-Policy header and no throttling after 20 failed logins.",
      "Log watch grouped 23 production errors into 2 signatures; the cart-total TypeError is already covered by the verified checkout fix.",
      "Nothing is waiting on approval. The next sweep runs at 09:00.",
    ].join("\n"),
  }];
}

export function sampleClusters(): { total: number; clusters: SignalClusterView[] } {
  return {
    total: 14,
    clusters: [
      { id: "demo-cluster-checkout", theme: "Checkout total mismatch", size: 8, angryShare: 0.5, sampleIds: ["demo-sig-1", "demo-sig-2"], samples: [`${SAMPLE} "My total changed at checkout"`, `${SAMPLE} "Charged more than my cart said"`] },
      { id: "demo-cluster-upload", theme: "Large file uploads vanish", size: 6, angryShare: 0.33, sampleIds: ["demo-sig-3"], samples: [`${SAMPLE} "Upload over 5 MB disappears with no error"`] },
    ],
  };
}

export function sampleLogWatch(): LogWatchView {
  return {
    id: "demo-logwatch-1", at: at(1), projectId: "demo-site (sample)", windowMinutes: 60, configured: true, total: 23,
    groups: [
      { signature: "TypeError: cart total undefined", service: "checkout (sample)", count: 14, sample: `${SAMPLE} TypeError in totals.ts on /checkout`, firstSeen: at(2), lastSeen: at(1) },
      { signature: "Upload size rejected silently", service: "uploads (sample)", count: 9, sample: `${SAMPLE} 413 swallowed by the client`, firstSeen: at(2), lastSeen: at(1) },
    ],
  };
}

export function sampleZoom(): ZoomView {
  return {
    configured: true, provider: "Simulated sample - connect Zoom in Settings for live bots",
    bots: [{ id: "demo-zoom-bot-1", meetingUrl: "https://zoom.us/j/sample-demo", status: "idle (sample)" }],
    setup: [`${SAMPLE} Demo Mode shows a simulated Zoom status. Production Mode uses the real Zoom connector.`],
  };
}

/** Findings for seeded demo runs, keyed by run id prefix. */
export function sampleFindings(runId: string): FindingView[] | null {
  if (!runId.startsWith("demo-run-")) return null;
  const base = {
    reproSteps: ["Open the sample Demo Site target", "Follow the ticket journey", "Compare expected and actual behaviour"],
    evidence: { screenshots: [], trace: "", logs: [`${SAMPLE} Seeded finding for the demo report.`] },
    confidence: "high", analysisSource: "heuristic",
  };
  if (runId.includes("checkout")) {
    return [
      { ...base, id: "demo-finding-checkout-total", category: "functional", severity: "blocker", title: "Cart total changes at checkout", suspectedCause: "A stale shipping fee is added twice when a coupon is applied.", suggestedFix: "Recompute shipping after coupon application and add a totals regression test.", regressionCheck: "Cart total equals checkout total with and without a coupon." },
      { ...base, id: "demo-finding-checkout-payment", category: "functional", severity: "major", title: "Valid cards rejected at payment", suspectedCause: "Card expiry validation compares against the wrong month boundary.", suggestedFix: "Fix the expiry boundary comparison and cover the current month in tests.", regressionCheck: "A card expiring this month is accepted." },
    ];
  }
  if (runId.includes("registration")) {
    return [{ ...base, id: "demo-finding-email", category: "functional", severity: "major", title: "Valid email addresses rejected", suspectedCause: "The email pattern rejects plus-addressing and subdomains.", suggestedFix: "Use a standards-based email check and add plus-address cases.", regressionCheck: "user+tag@mail.example.com registers successfully." }];
  }
  if (runId.includes("search")) {
    return [{ ...base, id: "demo-finding-search", category: "functional", severity: "major", title: "Category filters return unrelated products", suspectedCause: "The filter parameter is dropped when pagination state resets.", suggestedFix: "Preserve the active filter across pagination.", regressionCheck: "Filtering by category shows only that category on every page." }];
  }
  if (runId.includes("booking")) {
    return [{ ...base, id: "demo-finding-hotel", category: "functional", severity: "major", title: "Booking flow loses the selected hotel", suspectedCause: "Hotel id is not carried through the payment step (simulated target).", suggestedFix: "Persist the selected hotel id in booking state.", regressionCheck: "The confirmed hotel matches the selected hotel." }];
  }
  return [{ ...base, id: "demo-finding-generic", category: "usability", severity: "minor", title: "Sample finding for this demo run", suspectedCause: "Seeded for Demo Mode so reports are never empty.", suggestedFix: "Run a live investigation to replace this sample with real findings.", regressionCheck: "Live run produces real findings for this ticket." }];
}

export function sampleBriefs(runId: string): BriefView[] {
  if (!runId.startsWith("demo-run-")) return [];
  return [{
    findingId: "demo-finding-generic",
    directions: [
      { name: "Clarify in place", change: `${SAMPLE} Keep the layout, make the primary action and its label unambiguous.`, tradeoff: "Cheapest; keeps the layout stable." },
      { name: "Restructure the step", change: `${SAMPLE} One primary action per step; demote secondary actions to text links.`, tradeoff: "Bigger change; needs a full-journey retest." },
    ],
    componentPlan: `${SAMPLE} Update the component owning the flagged step; add a regression test for the core journey.`,
    images: [],
  }];
}
