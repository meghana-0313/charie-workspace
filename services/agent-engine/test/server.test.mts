// Server tests (offline, no browser, no sockets - the handler is invoked
// directly with mock req/res so this runs even in locked-down sandboxes).
// Covers: health, auth gate, request validation, run/artifacts reads.
import { strict as assert } from "node:assert";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/server.js";
import { _clearSecretCache } from "../src/secrets.js";

let n = 0;
const ok = (cond: unknown, msg: string) => { n++; assert.ok(cond, msg); };

const root = mkdtempSync(join(tmpdir(), "ghostqa-srv-"));
// Seed one finished run + one artifact.
mkdirSync(join(root, "done1", "mcp-packets"), { recursive: true });
writeFileSync(join(root, "done1", "findings.json"), JSON.stringify([{ id: "a" }]));
writeFileSync(join(root, "done1", "report.md"), "# R");
writeFileSync(join(root, "done1", "mcp-packets", "a.md"), "packet");
// Seed a baseline for the verify-path existence check (never executed here).
mkdirSync(join(root, "base1"), { recursive: true });
writeFileSync(join(root, "base1", "findings.json"), JSON.stringify([]));

process.env.ENGINE_TOKEN = "t0k";
const savedMetaKey = process.env.META_API_KEY;
const savedBasetenKey = process.env.BASETEN_API_KEY;
delete process.env.META_API_KEY;
delete process.env.BASETEN_API_KEY;
_clearSecretCache();
const app = createApp({ reportsRoot: root });

interface Shot {
  code: number;
  text: string;
  json(): unknown;
}

function call(method: string, url: string, headers: Record<string, string> = {}, body = ""): Promise<Shot> {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers,
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(body);
      },
    } as unknown as IncomingMessage;
    const res = {
      writeHead(code: number) {
        (res as unknown as { code: number }).code = code;
      },
      end(data: unknown) {
        const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data ?? "");
        resolve({ code: (res as unknown as { code: number }).code, text, json: () => JSON.parse(text) });
      },
    } as unknown as ServerResponse;
    app(req, res);
  });
}

const H = { "x-engine-token": "t0k" };

const health = await call("GET", "/health");
ok(health.code === 200 && (health.json() as { ok: boolean }).ok === true, "health ok");

ok((await call("GET", "/runs/nope")).code === 401, "missing token rejected");
ok((await call("GET", "/runs/nope", { "x-engine-token": "wrong" })).code === 401, "wrong token rejected");
ok((await call("GET", "/runs/nope", H)).code === 404, "unknown run 404");

const done = await call("GET", "/runs/done1", H);
const doneBody = done.json() as { status: string; findings: unknown[]; report: string };
ok(done.code === 200 && doneBody.status === "done", "done run status");
ok(doneBody.findings.length === 1 && doneBody.report === "# R", "done run payload");

const art = await call("GET", "/runs/done1/artifacts/mcp-packets/a.md", H);
ok(art.code === 200 && art.text === "packet", "artifact served");
ok((await call("GET", "/runs/done1/artifacts/../../x", H)).code === 404, "artifact traversal blocked");

const J = { ...H, "content-type": "application/json" };
ok((await call("POST", "/runs", J, "{nope")).code === 400, "invalid JSON 400");
ok((await call("POST", "/runs", H, "{}")).code === 400, "missing targetUrl 400");
ok((await call("POST", "/runs", H, JSON.stringify({ targetUrl: "notaurl" }))).code === 400, "bad targetUrl 400");
ok((await call("POST", "/runs", H, JSON.stringify({ targetUrl: "http://x/", verify: true }))).code === 400, "verify without baseline 400");
ok(
  (await call("POST", "/runs", H, JSON.stringify({ targetUrl: "http://x/", verify: true, baselineRunId: "ghost" }))).code === 404,
  "unknown baseline 404",
);
ok(
  (await call("POST", "/runs", H, JSON.stringify({ targetUrl: "http://169.254.169.254/" }))).code === 400,
  "metadata IP blocked",
);
ok(
  (await call("POST", "/runs", H, JSON.stringify({ targetUrl: "http://metadata.google.internal/" }))).code === 400,
  "metadata host blocked",
);

const tri = await call("POST", "/triage", H, JSON.stringify({ subject: "Checkout broken", body: "500 on pay" }));
const triBody = tri.json() as { goal: string; grade: string; source: string };
ok(tri.code === 200 && triBody.goal.length > 0 && ["blocker", "major", "minor"].includes(triBody.grade), "triage answers");
ok((await call("POST", "/triage", H, JSON.stringify({}))).code === 400, "triage needs subject/body");
ok((await call("POST", "/transcribe", H, JSON.stringify({}))).code === 400, "transcribe needs blob");
ok(
  (await call("POST", "/transcribe", H, JSON.stringify({ blob: "uploads/nope.wav" }))).code === 404,
  "transcribe unknown blob 404",
);

const benign = [{ id: "e1", ts: new Date().toISOString(), kind: "auth", outcome: "success" }];
const gClear = await call("POST", "/guardian/analyze", H, JSON.stringify({ events: benign }));
ok(gClear.code === 200 && (gClear.json() as { mode: string }).mode === "clear", "guardian clear window");
const attack = [];
for (let i = 0; i < 25; i++) {
  attack.push({ id: `a${i}`, ts: new Date().toISOString(), kind: "auth", outcome: "failure", actor: `u${i % 4}`, ip: "9.9.9.9" });
}
const gHit = await call("POST", "/guardian/analyze", H, JSON.stringify({ events: attack }));
const gHitBody = gHit.json() as { signals: Array<{ type: string }>; mode: string };
ok(gHit.code === 200 && gHitBody.signals.length === 1 && gHitBody.signals[0].type === "credential-stuffing", "guardian detects stuffing");
ok(gHitBody.mode === "signals-only", "no keys means signals only, no investigation");
ok((await call("POST", "/guardian/analyze", H, JSON.stringify({}))).code === 400, "guardian needs events");
const gResp = await call("POST", "/guardian/respond", H, JSON.stringify({ action: "block_ip", target: "9.9.9.9" }));
ok(gResp.code === 200 && (gResp.json() as { status: string }).status === "simulated-contained", "guardian simulated response");
ok((await call("POST", "/guardian/respond", H, JSON.stringify({ action: "nuke", target: "x" }))).code === 400, "guardian rejects bad action");
const gVer = await call("POST", "/guardian/verify", H, JSON.stringify({ baselineSuspicious: 10, events: [] }));
ok(gVer.code === 200 && (gVer.json() as { contained: boolean }).contained === true, "guardian verify containment");

delete process.env.ENGINE_TOKEN;
if (savedMetaKey !== undefined) process.env.META_API_KEY = savedMetaKey;
if (savedBasetenKey !== undefined) process.env.BASETEN_API_KEY = savedBasetenKey;
_clearSecretCache();
console.log(`SERVER PASS: ${n}/${n} assertions`);
