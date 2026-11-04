// Engine service entry. Local: tsx src/serve.ts. Prod: node dist/serve.js.

import { createServer } from "node:http";
import { resolve } from "node:path";
import { loadSecrets, secret } from "./secrets.js";
import { createApp } from "./server.js";

await loadSecrets();
// The engine API drives browsers and reads reports: never serve it
// unauthenticated. Local dev opts out explicitly with ENGINE_DEV_OPEN=1.
if (!secret("ENGINE_TOKEN") && process.env.ENGINE_DEV_OPEN !== "1") {
  console.error("[engine] ENGINE_TOKEN is not set (env or Secret Manager). Refusing to start unauthenticated. Set ENGINE_TOKEN, or ENGINE_DEV_OPEN=1 for local dev.");
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3103);
const reportsRoot = process.env.CHARIE_REPORTS ?? resolve(process.cwd(), "reports");
createServer(createApp({ reportsRoot })).listen(port, () => {
  console.log(`[engine] listening on :${port} (reports: ${reportsRoot})`);
});
