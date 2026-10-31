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

delete process.env.ENGINE_TOKEN;
_clearSecretCache();
console.log(`SERVER PASS: ${n}/${n} assertions`);
