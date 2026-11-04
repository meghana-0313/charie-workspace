// Smoke test: speaks real MCP JSON-RPC over stdio to src/index.ts,
// pointed at fixtures/sample-run. Exits non-zero on any mismatch.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const tsxCli = join(dir, "..", "..", "node_modules", "tsx", "dist", "cli.mjs");
const child = spawn(process.execPath, [tsxCli, "src/index.ts"], {
  cwd: dir,
  env: { ...process.env, CHARIE_REPORTS: join(dir, "fixtures") },
  stdio: ["pipe", "pipe", "inherit"],
});

const pending = new Map();
let nextId = 1;
let buf = "";
child.stdout.on("data", (c) => {
  buf += c.toString();
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n");
}
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

try {
  await send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "charie-smoke", version: "0.0.0" },
  });
  notify("notifications/initialized");
  const tools = await send("tools/list", {});
  const names = tools.tools.map((t) => t.name);
  assert(names.includes("list_runs"), "list_runs tool missing");
  assert(names.includes("get_finding"), "get_finding tool missing");

  const runs = JSON.parse((await send("tools/call", { name: "list_runs", arguments: {} })).content[0].text);
  assert(runs.includes("sample-run"), `sample-run missing from ${JSON.stringify(runs)}`);

  const findings = JSON.parse(
    (await send("tools/call", { name: "list_findings", arguments: { run: "sample-run" } })).content[0].text,
  );
  assert(findings.findings.length === 2, "expected 2 fixture findings");

  const detail = JSON.parse(
    (await send("tools/call", { name: "get_finding", arguments: { run: "sample-run", id: "functional-checkout-3-items" } }))
      .content[0].text,
  );
  assert(detail.finding.severity === "blocker", "wrong finding detail");
  assert(detail.fixPacket.includes("Required fix"), "fix packet missing");

  console.log("SMOKE PASS: 4/4 MCP tool calls ok (list_runs, list_findings, get_finding)");
} finally {
  child.kill();
}
