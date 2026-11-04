// Live site monitor: real probes, real numbers, nothing simulated.
//
// The Live Signals page polls /api/guardian/live-monitor every 3 seconds.
// Each poll fetches the target site at that moment (home page, product
// API, build flavor, and a 3-item checkout probe against the demo site's
// known seeded failure) and times every request. The graph and signals
// on screen are those measurements - if the site goes down or the
// checkout bug is fixed, the panel shows it within one poll.

export interface LiveCheck {
  name: string;
  ok: boolean;
  status: number | null;
  ms: number;
  detail: string;
}

export interface LiveSignal {
  level: "critical" | "warn" | "info" | "ok";
  text: string;
}

export interface LiveProbe {
  at: string;
  target: string;
  reachable: boolean;
  checks: LiveCheck[];
  signals: LiveSignal[];
}

export const HOSTED_DEMO_TARGET = "https://charie-demo-ehfuotlisq-uc.a.run.app";
export const LOCAL_DEMO_TARGET = "http://localhost:3101";

/** Which site the monitor watches. An explicit env/configured target
 *  always wins; demo accounts watch the demo site (hosted build when the
 *  portal itself is hosted, local build when filming locally). */
export function resolveLiveTarget(opts: {
  envUrl?: string | null;
  settingUrl?: string | null;
  demo: boolean;
  hosted: boolean;
}): string {
  const env = (opts.envUrl ?? "").trim();
  if (env) return env.replace(/\/$/, "");
  const setting = (opts.settingUrl ?? "").trim();
  if (setting) return setting.replace(/\/$/, "");
  if (opts.demo) return opts.hosted ? HOSTED_DEMO_TARGET : LOCAL_DEMO_TARGET;
  return LOCAL_DEMO_TARGET;
}

/** Turn one round of raw checks into human signals. Pure: unit tested. */
export function deriveSignals(checks: LiveCheck[]): LiveSignal[] {
  const signals: LiveSignal[] = [];
  const home = checks.find((c) => c.name === "Home page");
  const products = checks.find((c) => c.name === "Products API");
  const build = checks.find((c) => c.name === "Build flavor");
  const checkout = checks.find((c) => c.name === "Checkout probe (3 items)");

  if (home && !home.ok && home.status === null) {
    signals.push({ level: "critical", text: "Site unreachable - no response at all. Check the demo site is running." });
    return signals;
  }
  if (home && !home.ok) signals.push({ level: "critical", text: `Home page returned HTTP ${home.status}.` });
  if (home && home.ok && home.ms > 800) signals.push({ level: "warn", text: `Home page is slow: ${home.ms} ms (over the 800 ms watch line).` });
  if (products && !products.ok) signals.push({ level: "warn", text: `Products API failing (HTTP ${products.status ?? "no response"}).` });
  if (checkout && checkout.status === 500) {
    signals.push({ level: "critical", text: "Live right now: checkout fails for carts with 3+ items (HTTP 500 ORDER_SPLIT_FAILED). This is the seeded demo-site bug, caught by probing - not a cached result." });
  } else if (checkout && checkout.ok) {
    signals.push({ level: "ok", text: "Checkout probe passes: a 3-item cart checks out. The seeded bug is not present in this build." });
  } else if (checkout && !checkout.ok) {
    signals.push({ level: "warn", text: `Checkout probe returned HTTP ${checkout.status ?? "no response"}.` });
  }
  if (build && build.ok) signals.push({ level: "info", text: `Serving the ${build.detail} build of the demo site.` });
  if (signals.length === 0) signals.push({ level: "ok", text: "All probes green on the last check." });
  return signals;
}

async function timed(target: string, path: string, name: string, init?: RequestInit, detail?: (body: string) => string): Promise<LiveCheck> {
  const started = Date.now();
  try {
    const res = await fetch(target + path, { ...init, signal: AbortSignal.timeout(2500), cache: "no-store" });
    const body = await res.text().catch(() => "");
    return {
      name,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      detail: detail ? detail(body.slice(0, 5000)) : `HTTP ${res.status}`,
    };
  } catch {
    return { name, ok: false, status: null, ms: Date.now() - started, detail: "no response" };
  }
}

/** Probe the target once, right now. Every number is measured here. */
export async function runLiveProbe(target: string): Promise<LiveProbe> {
  const checks = await Promise.all([
    timed(target, "/", "Home page"),
    timed(target, "/api/products", "Products API", undefined, (b) => {
      try { return `${(JSON.parse(b) as unknown[]).length} products listed`; } catch { return "responded"; }
    }),
    timed(target, "/api/build", "Build flavor", undefined, (b) => {
      try { return String((JSON.parse(b) as { build?: string }).build ?? "unknown"); } catch { return "unknown"; }
    }),
    timed(target, "/api/checkout", "Checkout probe (3 items)", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ id: "bus-ticket", qty: 1 }, { id: "rail-ticket", qty: 1 }, { id: "ferry-ticket", qty: 1 }] }),
    }, (b) => b.slice(0, 120)),
  ]);
  return {
    at: new Date().toISOString(),
    target,
    reachable: checks.some((c) => c.status !== null),
    checks,
    signals: deriveSignals(checks),
  };
}
