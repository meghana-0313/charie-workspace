// CSP regression guard: the portal policy must let Firebase Auth work in the
// browser (auth iframe + REST calls) without dropping the hardening defaults.
// A stricter policy shipped once and broke Google sign-in (auth/internal-error).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const cfg = (await import("../next.config.mjs")).default as {
  headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
  rewrites: () => Promise<Array<{ source: string; destination: string }>>;
};

async function csp(): Promise<string> {
  const all = await cfg.headers();
  const portalWide = all.find((h) => h.source === "/:path*");
  const entry = (portalWide?.headers ?? [])
    .find((h) => h.key.toLowerCase() === "content-security-policy");
  assert.ok(entry, "Content-Security-Policy header is set");
  return entry.value;
}

function directive(v: string, name: string): string {
  return new RegExp(`(?:^|;)\\s*${name} ([^;]+)`).exec(v)?.[1] ?? "";
}

describe("content security policy", () => {
  it("allows the Firebase Auth iframe", async () => {
    const frame = directive(await csp(), "frame-src");
    assert.match(frame, /firebaseapp\.com/, "frame-src must allow the Firebase auth domain");
  });
  it("allows Firebase Auth REST calls", async () => {
    const connect = directive(await csp(), "connect-src");
    assert.match(connect, /identitytoolkit\.googleapis\.com/);
    assert.match(connect, /securetoken\.googleapis\.com/);
  });
  it("keeps the hardening defaults", async () => {
    const v = await csp();
    assert.match(v, /default-src 'self'/);
    assert.match(v, /frame-ancestors 'none'/);
  });
  it("serves the Firebase auth handler on the portal origin", async () => {
    const rw = await cfg.rewrites();
    const auth = rw.find((r) => r.source.startsWith("/__/auth"));
    assert.ok(auth, "a /__/auth rewrite exists");
    assert.match(auth.destination, /firebaseapp\.com\/__\/auth\//);
  });
});
