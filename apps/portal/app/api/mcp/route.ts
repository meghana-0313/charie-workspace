// Charie MCP over HTTP: the cloud twin of the local stdio MCP server.
//
// Coding agents (Muse Code, Cursor, Codex) connect with a Charie API key
// (Team and access page) and pull investigation evidence scoped to the
// account that owns the key: list_runs, list_findings, get_finding (with the
// markdown fix packet), get_verification, list_tickets. JSON-RPC 2.0 in,
// JSON-RPC 2.0 out, one POST per call like the MCP streamable HTTP transport.
//
// Auth: "Authorization: Bearer chp_..." (ingest key) or the session cookie
// when a signed in teammate pokes it from the browser. Reads only; every run
// is checked against the caller account before any artifact is returned.

import { NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/keys";
import { identity } from "@/lib/who";
import { store } from "@/lib/store";
import { readFindings, readPacket, readVerification } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOOLS = [
  {
    name: "list_runs",
    description: "List your Charie investigation and verification runs (newest first).",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Max runs, default 20" } } },
  },
  {
    name: "list_findings",
    description: "List findings (id, severity, category, title, confidence) for a run. Defaults to your newest run.",
    inputSchema: {
      type: "object",
      properties: { run: { type: "string", description: "Run id; omit for newest" } },
    },
  },
  {
    name: "get_finding",
    description: "Full finding detail plus the markdown fix packet (repro, suspected cause, fix instruction, regression check).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Finding id, e.g. functional-checkout-3-items" },
        run: { type: "string", description: "Run id; omit for newest" },
      },
    },
  },
  {
    name: "get_verification",
    description: "Verification proof for a run: before/after verdicts per finding.",
    inputSchema: {
      type: "object",
      properties: { run: { type: "string", description: "Run id; omit for newest" } },
    },
  },
  {
    name: "list_tickets",
    description: "List your tickets with status, so an agent can pick up the work Charie already investigated.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

async function callerUid(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const rec = await verifyApiKey(auth.slice(7)).catch(() => null);
    return rec ? rec.uid ?? "shared" : null;
  }
  const me = await identity(req);
  return me?.uid ?? null;
}

/** A run is visible when it belongs to the caller; legacy runs without an owner stay readable. */
async function ownRun(uidKey: string, runId?: string) {
  if (runId) {
    const run = await store.getRun(runId).catch(() => null);
    if (!run) return null;
    return !run.uid || run.uid === uidKey ? run : null;
  }
  const runs = await store.listRuns(1, uidKey).catch(() => []);
  return runs[0] ?? null;
}

function text(payload: unknown, isError = false) {
  return {
    content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

async function callTool(uidKey: string, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_runs": {
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20) || 20));
      const runs = await store.listRuns(limit, uidKey);
      return text(runs.map((r) => ({
        id: r.id, ticketId: r.ticketId, kind: r.kind, targetUrl: r.targetUrl, status: r.status, createdAt: r.createdAt,
      })));
    }
    case "list_tickets": {
      const tickets = await store.listTickets(uidKey);
      return text(tickets.slice(0, 50).map((t) => ({ id: t.id, subject: t.subject, status: t.status, targetUrl: t.targetUrl })));
    }
    case "list_findings": {
      const run = await ownRun(uidKey, typeof args.run === "string" ? args.run : undefined);
      if (!run) return text("No run found for your account.", true);
      const findings = (await readFindings(run.id).catch(() => null)) ?? [];
      return text({ run: run.id, findings: findings.map((f) => ({ id: f.id, severity: f.severity, category: f.category, title: f.title, confidence: f.confidence })) });
    }
    case "get_finding": {
      const run = await ownRun(uidKey, typeof args.run === "string" ? args.run : undefined);
      if (!run) return text("No run found for your account.", true);
      const findings = (await readFindings(run.id).catch(() => null)) ?? [];
      const f = findings.find((x) => x.id === String(args.id ?? ""));
      if (!f) return text(`Finding ${String(args.id ?? "")} not found in run ${run.id}.`, true);
      const packet = await readPacket(run.id, f.id).catch(() => null);
      return text({ run: run.id, finding: f, fixPacket: packet });
    }
    case "get_verification": {
      const run = await ownRun(uidKey, typeof args.run === "string" ? args.run : undefined);
      if (!run) return text("No run found for your account.", true);
      const verification = await readVerification(run.id).catch(() => null);
      return text({ run: run.id, verification });
    }
    default:
      return text(`Unknown tool ${name}.`, true);
  }
}

interface RpcCall { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }

export async function POST(req: Request) {
  const uidKey = await callerUid(req);
  if (!uidKey) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized: send Authorization: Bearer <Charie API key> (mint one under Team and access)" } },
      { status: 401 },
    );
  }
  const body = (await req.json().catch(() => null)) as RpcCall | null;
  if (!body || typeof body.method !== "string") {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } }, { status: 400 });
  }
  const id = body.id ?? null;
  // Notifications (no id) need no reply.
  if (body.id === undefined) return new NextResponse(null, { status: 202 });
  switch (body.method) {
    case "initialize":
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "charie", version: "1.0.0" },
        },
      });
    case "ping":
      return NextResponse.json({ jsonrpc: "2.0", id, result: {} });
    case "tools/list":
      return NextResponse.json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    case "tools/call": {
      const name = String(body.params?.name ?? "");
      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
      if (!TOOLS.some((t) => t.name === name)) {
        return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32602, message: `unknown tool ${name}` } });
      }
      try {
        return NextResponse.json({ jsonrpc: "2.0", id, result: await callTool(uidKey, name, args) });
      } catch (e) {
        return NextResponse.json({ jsonrpc: "2.0", id, result: text(`tool failed: ${(e as Error).message}`, true) });
      }
    }
    default:
      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `method ${body.method} not found` } });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "POST JSON-RPC here. tools: list_runs, list_findings, get_finding, get_verification, list_tickets" },
    { status: 405 },
  );
}
