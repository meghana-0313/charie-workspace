// GhostQA MCP server (stdio). Lets a coding agent (Muse Code, etc.) pull
// investigation evidence and push back toward verification:
//   list_runs → list_findings → get_finding (repro + fix packet) → … → get_verification
//
// Reports dir: GHOSTQA_REPORTS env, else ../agent-engine/reports.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const REPORTS = process.env.GHOSTQA_REPORTS ?? new URL("../../agent-engine/reports", import.meta.url).pathname;

async function listRuns(): Promise<string[]> {
  try {
    const entries = await readdir(REPORTS, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse();
  } catch {
    return [];
  }
}

async function readJson<T>(run: string, file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(REPORTS, run, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function defaultRun(): Promise<string | null> {
  const runs = await listRuns();
  return runs[0] ?? null;
}

const server = new McpServer({ name: "ghostqa", version: "0.1.0" });

server.tool("list_runs", "List GhostQA investigation runs (newest first).", {}, async () => ({
  content: [{ type: "text", text: JSON.stringify(await listRuns()) }],
}));

server.tool(
  "list_findings",
  "List findings (id, severity, category, title, status) for a run. Defaults to newest run.",
  { run: z.string().optional().describe("Run directory name; omit for newest") },
  async ({ run }) => {
    const r = run ?? (await defaultRun());
    if (!r) return { content: [{ type: "text", text: "No runs found." }] };
    const findings = (await readJson<Array<Record<string, unknown>>>(r, "findings.json")) ?? [];
    const slim = findings.map((f) => ({
      id: f.id, severity: f.severity, category: f.category, title: f.title, status: f.status,
    }));
    return { content: [{ type: "text", text: JSON.stringify({ run: r, findings: slim }) }] };
  },
);

server.tool(
  "get_finding",
  "Full finding detail: repro steps, evidence, suspected cause, fix instruction, regression check.",
  {
    id: z.string().describe("Finding id, e.g. functional-checkout-3-items"),
    run: z.string().optional().describe("Run directory name; omit for newest"),
  },
  async ({ id, run }) => {
    const r = run ?? (await defaultRun());
    if (!r) return { content: [{ type: "text", text: "No runs found." }] };
    const findings = (await readJson<Array<Record<string, unknown>>>(r, "findings.json")) ?? [];
    const f = findings.find((x) => x.id === id);
    if (!f) return { content: [{ type: "text", text: `Finding ${id} not found in run ${r}.` }] };
    let packet = "";
    try {
      packet = await readFile(join(REPORTS, r, "mcp-packets", `${id}.md`), "utf8");
    } catch { /* packet optional */ }
    return {
      content: [{ type: "text", text: JSON.stringify({ run: r, finding: f, fixPacket: packet || null }) }],
    };
  },
);

server.tool(
  "get_verification",
  "Before/after verification result for a run (fixed / still-open / new per finding).",
  { run: z.string().describe("Verify-run directory name") },
  async ({ run }) => {
    const v = await readJson<unknown>(run, "verification.json");
    if (!v) return { content: [{ type: "text", text: `No verification.json in run ${run}.` }] };
    return { content: [{ type: "text", text: JSON.stringify(v) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
