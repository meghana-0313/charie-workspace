// Engine service entry. Local: tsx src/serve.ts. Prod: node dist/serve.js.

import { createServer } from "node:http";
import { resolve } from "node:path";
import { loadSecrets } from "./secrets.js";
import { createApp } from "./server.js";

await loadSecrets();
const port = Number(process.env.PORT ?? 3103);
const reportsRoot = process.env.GHOSTQA_REPORTS ?? resolve(process.cwd(), "reports");
createServer(createApp({ reportsRoot })).listen(port, () => {
  console.log(`[engine] listening on :${port} (reports: ${reportsRoot})`);
});
