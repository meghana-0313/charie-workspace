// Engine service entry. Local: tsx src/serve.ts. Prod: node dist/serve.js.

import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSecrets, secret } from "./secrets.js";
import { createApp } from "./server.js";

const loadedSecrets = await loadSecrets();
// Names and counts only, never values: Cloud Run logs must be able to
// answer "did META_API_KEY reach this process" at a glance.
console.log(`[engine] secrets loaded: ${loadedSecrets.loaded.join(", ") || "none"}; missing: ${loadedSecrets.missing.join(", ") || "none"}`);
// The engine API drives browsers and reads reports: never serve it
// unauthenticated. Local dev opts out explicitly with ENGINE_DEV_OPEN=1.
if (!secret("ENGINE_TOKEN") && process.env.ENGINE_DEV_OPEN !== "1") {
  console.error("[engine] ENGINE_TOKEN is not set (env or Secret Manager). Refusing to start unauthenticated. Set ENGINE_TOKEN, or ENGINE_DEV_OPEN=1 for local dev.");
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3103);
// Reports (scan results, digests, work orders) anchor to the engine
// package, never to wherever the process happened to be started from:
// starting the engine from a different directory must not make a user's
// saved progress vanish on the next refresh.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportsRoot = process.env.CHARIE_REPORTS ?? resolve(packageRoot, "reports");
createServer(createApp({ reportsRoot })).listen(port, () => {
  console.log(`[engine] listening on :${port} (reports: ${reportsRoot})`);
});
