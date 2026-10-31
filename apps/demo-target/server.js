// ShopFast demo store - zero-dependency static server + buggy checkout API.
//
// Seeded defects (ground truth lives in README.md):
//   BUG-1 (functional, blocker): POST /api/checkout returns 500 when the cart has
//          3+ items. The frontend swallows the error: spinner stops, no message.
//   (Usability + a11y seeds live in public/checkout.html.)
//
// Run normal (buggy):  npm run dev
// Run fixed build:     npm run dev:fixed   (simulates the post-fix build)

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const pubDir = join(root, "public");
const PORT = Number(process.env.PORT ?? 3101);
const FIXED = process.argv.includes("--fixed") || process.env.FIXED_BUILD === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

const PRODUCTS = [
  { id: "bus-ticket", name: "Metro Bus Pass", price: 12.5, blurb: "Unlimited city rides for a day." },
  { id: "rail-ticket", name: "Express Rail Ticket", price: 34.0, blurb: "Downtown to airport, no stops." },
  { id: "ferry-ticket", name: "Harbor Ferry Pass", price: 9.75, blurb: "Round trip across the bay." },
  { id: "bike-rental", name: "City Bike Rental", price: 6.0, blurb: "Two hours, any docking station." },
];

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/api/products" && req.method === "GET") {
      return send(res, 200, JSON.stringify(PRODUCTS), MIME[".json"]);
    }

    if (url.pathname === "/api/build" && req.method === "GET") {
      return send(res, 200, JSON.stringify({ build: FIXED ? "fixed" : "buggy" }), MIME[".json"]);
    }

    if (url.pathname === "/api/checkout" && req.method === "POST") {
      const body = await readJson(req);
      const itemCount = (body.items ?? []).reduce((n, i) => n + (i.qty ?? 1), 0);
      // ---- SEEDED BUG BUG-1: 3+ items explode, fixed build accepts everything ----
      if (!FIXED && itemCount >= 3) {
        console.log(`[buggy] checkout failed: ${itemCount} items -> 500`);
        return send(
          res,
          500,
          JSON.stringify({ error: "ORDER_SPLIT_FAILED", message: "Fulfillment split failed" }),
          MIME[".json"],
        );
      }
      const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      console.log(`[${FIXED ? "fixed" : "buggy"}] checkout ok: ${itemCount} items -> ${orderId}`);
      return send(res, 200, JSON.stringify({ orderId }), MIME[".json"]);
    }

    // Static files (also inject build flag into HTML for the fixed-build behavior).
    let rel = normalize(url.pathname).replace(/^([/\\])+/, "");
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    if (!extname(rel)) rel += ".html";
    const file = join(pubDir, rel);
    if (!file.startsWith(pubDir)) return send(res, 403, "forbidden");
    try {
      let content = await readFile(file, "utf8");
      if (file.endsWith(".html")) {
        content = content.replace(
          "</head>",
          `<script>window.__BUILD = ${JSON.stringify(FIXED ? "fixed" : "buggy")};</script></head>`,
        );
      }
      return send(res, 200, content, MIME[extname(file)] ?? "application/octet-stream");
    } catch {
      return send(res, 404, "not found");
    }
  } catch (e) {
    console.error(e);
    return send(res, 500, "server error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ShopFast (${FIXED ? "FIXED" : "BUGGY"} build) at http://localhost:${PORT}`);
});
