// Middleware gate: public carve-outs reach their routes; everything else
// bounces to /login. The /api/mcp carve-out must NOT depend on an
// Authorization header being present: keyless agents deserve the route's
// JSON 401, not an HTML login redirect (regression: sverify "mcp requires
// key" saw a 405 from the redirected POST /login).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";

const { middleware } = await import("../middleware.ts");

function fakeReq(path: string, headers: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost${path}`);
  return {
    cookies: { get: () => undefined },
    headers: new Headers(headers),
    nextUrl: Object.assign(url, { clone: () => new URL(url.toString()) }),
  } as unknown as NextRequest;
}

const isRedirect = (res: Response) => res.status === 307 || res.status === 308;

describe("middleware gate", () => {
  it("lets keyless /api/mcp reach the route (route answers 401 JSON)", async () => {
    const res = await middleware(fakeReq("/api/mcp"));
    assert.equal(isRedirect(res), false);
  });

  it("lets authorized /api/mcp reach the route", async () => {
    const res = await middleware(fakeReq("/api/mcp", { authorization: "Bearer chp_x" }));
    assert.equal(isRedirect(res), false);
  });

  it("still bounces anonymous API calls to /login", async () => {
    const res = await middleware(fakeReq("/api/tickets"));
    assert.equal(isRedirect(res), true);
    assert.match(res.headers.get("location") ?? "", /\/login$/);
  });

  it("still bounces anonymous pages to /login", async () => {
    const res = await middleware(fakeReq("/guardian"));
    assert.equal(isRedirect(res), true);
  });

  it("keeps the keyed SDK ingest carve-out", async () => {
    const res = await middleware(fakeReq("/api/guardian/events", { "x-charie-key": "chp_x" }));
    assert.equal(isRedirect(res), false);
  });
});
