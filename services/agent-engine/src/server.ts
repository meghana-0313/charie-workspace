// Engine HTTP service (Cloud Run). Same runs as the CLI, driven over HTTP so
// the portal (a separate container) can trigger and poll them.
//
//   POST /runs                    {targetUrl, goal?, verify?, baselineRunId?} → {runId}
//   GET  /runs/:id                {runId, status, findings?, verification?, report?, error?}
//   GET  /runs/:id/artifacts/<..> report file bytes (screenshots, packets, …)
//   GET  /health                  {ok: true}
//   Guardian suite:
//   POST /guardian/analyze  POST /guardian/respond  POST /guardian/verify
//   POST /guardian/sweep  GET /guardian/sweeps
//   GET+POST /workorders  GET /workorders/:id  POST :id/approve  POST :id/schedule
//   POST /nightshift/run  GET /nightshift/digests
//   POST /signals/ingest  GET /signals/clusters  POST /signals/seed
//   POST /pentest/run  GET /zoom/status  POST /zoom/join
//   POST /a11y/run  GET /a11y/reports  POST /firstrun/run  GET /firstrun/reports
//   POST /guardian/logwatch  GET /guardian/logwatch
//   POST /chat/turn {history, snapshot?, contextNotes?} -> {kind, tool?, args?, text?, model}
//
// Auth: x-engine-token must equal the ENGINE_TOKEN secret. When no token is
// configured (local dev without GCP), auth is skipped with a one-time warning.

import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize, sep } from "node:path";
import { GOAL } from "./explorer.js";
import { runA11y } from "./a11y.js";
import { runFirstRun } from "./firstrun.js";
import { detectSignals, investigate, simulateResponse, verifyContainment } from "./guardian.js";
import { executeRun } from "./job.js";
import { loadDigests, runNightShift } from "./nightshift.js";
import { runLogWatch } from "./logwatch.js";
import { runPentest } from "./pentest.js";
import { secret } from "./secrets.js";
import { appendMessages, clusterMessages, gradeMessage, loadMessages, seedMessages } from "./signals.js";
import type { SignalMessage } from "./signals.js";
import { ensureRunLocal, fetchVoiceNote } from "./storage.js";
import { loadSweeps, runSweep } from "./sweep.js";
import { extractGoal, glimmerTriage, preGrade } from "./triage.js";
import { chatTurn } from "./chat-agent.js";
import { describeScreenDetailed } from "./vision.js";
import { transcribe } from "./voice.js";
import {
  approveWorkOrder, createWorkOrder, getWorkOrder, loadWorkOrders, updateWorkOrder,
} from "./workorders.js";
import type { WorkOrderStep } from "./workorders.js";
import { joinMeeting, zoomStatus } from "./zoom.js";

/** Hosts the engine must never drive: cloud metadata (credential theft),
 *  loopback, and private or link-local ranges (SSRF into internal services). */
function targetBlocked(targetUrl: string): boolean {
  let host: string;
  try {
    host = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.includes(":")) {
    // IPv6 literal: block loopback, unspecified, link-local, and unique-local.
    if (host === "::1" || host === "::" || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb") || host.startsWith("fc") || host.startsWith("fd")) return true;
  }
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224) return true;
  }
  return host === "metadata" || host === "metadata.google.internal";
}

export interface ServerOpts {
  reportsRoot: string;
}

type JobState = { status: "running" | "done" | "failed"; error?: string };

const MAX_BODY = 1024 * 1024;

function send(res: ServerResponse, code: number, body: unknown, type = "application/json"): void {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { "content-type": type });
  res.end(data);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function mimeOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "json" || ext === "md") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export function createApp(opts: ServerOpts): RequestListener {
  const jobs = new Map<string, JobState>();
  const root = opts.reportsRoot;
  const dataRoot = join(root, "_guardian");
  // Guardian data is stored per account (x-charie-account header); callers
  // without an account share the legacy root so old data stays readable.
  function accountOf(req: IncomingMessage): string {
    const raw = String(req.headers["x-charie-account"] ?? "").trim();
    return /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : "shared";
  }
  function acctData(req: IncomingMessage): string {
    const a = accountOf(req);
    return a === "shared" ? dataRoot : join(dataRoot, "acct", a);
  }
  let warnedNoAuth = false;
  let activeRuns = 0;
  let shiftRunning = false;

  function liveTargets(body: { portalUrl?: string; engineUrl?: string }): { portalUrl: string; engineUrl: string } {
    return {
      portalUrl: body.portalUrl ?? process.env.PORTAL_URL ?? "",
      engineUrl: body.engineUrl ?? process.env.ENGINE_PUBLIC_URL ?? "",
    };
  }

  async function jsonBody(req: IncomingMessage): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false }> {
    try {
      return { ok: true, body: JSON.parse(await readBody(req)) as Record<string, unknown> };
    } catch {
      return { ok: false };
    }
  }

  function authorized(req: IncomingMessage): boolean {
    const expected = secret("ENGINE_TOKEN");
    if (!expected) {
      if (!warnedNoAuth) {
        warnedNoAuth = true;
        console.warn("[engine] ENGINE_TOKEN unset - API auth disabled (local dev only)");
      }
      return true;
    }
    const presented = req.headers["x-engine-token"];
    const a = Buffer.from(Array.isArray(presented) ? (presented[0] ?? "") : (presented ?? ""));
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  function runStatus(runId: string): "running" | "done" | "failed" {
    const seen = jobs.get(runId);
    if (seen && seen.status !== "running") return seen.status;
    const dir = join(root, runId);
    if (existsSync(join(dir, "findings.json"))) return "done";
    if (seen || existsSync(dir)) return "running";
    return "failed";
  }

  return (req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", "http://x");
        if (req.method === "GET" && url.pathname === "/health") {
          send(res, 200, { ok: true, time: new Date().toISOString() });
          return;
        }
        if (!authorized(req)) {
          send(res, 401, { error: "bad or missing x-engine-token" });
          return;
        }

        if (req.method === "POST" && url.pathname === "/runs") {
          let body: { targetUrl?: string; goal?: string; verify?: boolean; baselineRunId?: string };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          const { targetUrl, goal, verify: verifyMode, baselineRunId } = body;
          if (!targetUrl) {
            send(res, 400, { error: "targetUrl required" });
            return;
          }
          try {
            new URL(targetUrl);
          } catch {
            send(res, 400, { error: "targetUrl must be a valid URL" });
            return;
          }
          if (targetBlocked(targetUrl)) {
            send(res, 400, { error: "target blocked" });
            return;
          }
          if (activeRuns >= 1) {
            send(res, 429, { error: "engine busy, retry shortly" });
            return;
          }
          if (verifyMode && !baselineRunId) {
            send(res, 400, { error: "verify needs baselineRunId" });
            return;
          }
          if (verifyMode && baselineRunId && !existsSync(join(root, baselineRunId, "findings.json"))) {
            send(res, 404, { error: "unknown baselineRunId" });
            return;
          }
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const runId = verifyMode ? `${stamp}-verify` : stamp;
          jobs.set(runId, { status: "running" });
          activeRuns++;
          executeRun({
            targetUrl,
            goal: goal?.trim() || GOAL,
            verifyMode: verifyMode === true,
            baselineRunId,
            outDir: join(root, runId),
            reportsRoot: root,
          }).then(
            () => {
              activeRuns--;
              jobs.set(runId, { status: "done" });
            },
            (e: Error) => {
              activeRuns--;
              jobs.set(runId, { status: "failed", error: e.message });
            },
          );
          send(res, 201, { runId, status: "running" });
          return;
        }

        if (req.method === "POST" && url.pathname === "/chat/turn") {
          let body: { history?: Array<{ role?: string; content?: string }>; snapshot?: unknown; contextNotes?: string[]; model?: string; effort?: string };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          const history = Array.isArray(body.history) ? body.history : [];
          const clean = history
            .filter((t) => t && typeof t.content === "string" && (t.role === "user" || t.role === "assistant" || t.role === "tool"))
            .map((t) => ({ role: t.role as "user" | "assistant" | "tool", content: String(t.content).slice(0, 4000) }))
            .slice(-12);
          if (clean.length === 0) {
            send(res, 400, { error: "history with at least one turn required" });
            return;
          }
          const out = await chatTurn({
            history: clean, snapshot: body.snapshot, contextNotes: body.contextNotes,
            model: (["auto", "baseten", "meta", "heuristic"].includes(body.model ?? "") ? body.model : "auto") as never,
            effort: (["low", "medium", "high"].includes(body.effort ?? "") ? body.effort : "medium") as never,
          });
          send(res, 200, out);
          return;
        }

        if (req.method === "POST" && url.pathname === "/vision/describe") {
          let body: { image?: string; question?: string; fast?: boolean };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          const image = String(body.image ?? "");
          if (!image.startsWith("data:image/") || image.length > 2_000_000) {
            send(res, 400, { error: "image data URI (max 2MB) required" });
            return;
          }
          const started = Date.now();
          const out = await describeScreenDetailed(image, String(body.question ?? "").slice(0, 300), fetch, body.fast === true);
          if (!out.ok) {
            send(res, 503, { error: `vision unavailable: ${out.reason}` });
            return;
          }
          send(res, 200, { text: out.text, model: out.model, ms: Date.now() - started });
          return;
        }

        if (req.method === "POST" && url.pathname === "/triage") {
          let body: { subject?: string; body?: string };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          if (!body.subject || !body.body) {
            send(res, 400, { error: "subject and body required" });
            return;
          }
          const g = await glimmerTriage(body.subject, body.body);
          if (g) {
            send(res, 200, { goal: g.goal, grade: g.grade, source: "muse-glimmer" });
            return;
          }
          send(res, 200, {
            goal: extractGoal(body.subject, body.body),
            grade: preGrade(body.subject, body.body),
            source: "heuristic",
          });
          return;
        }

        if (req.method === "POST" && url.pathname === "/transcribe") {
          let body: { blob?: string };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          if (!body.blob) {
            send(res, 400, { error: "blob required" });
            return;
          }
          const bytes = await fetchVoiceNote(body.blob);
          if (!bytes) {
            send(res, 404, { error: "unknown blob" });
            return;
          }
          const ext = body.blob.split(".").pop()?.toLowerCase() ?? "bin";
          const tmp = join(tmpdir(), `charie-tr-${Date.now()}.${ext}`);
          writeFileSync(tmp, bytes);
          try {
            const out = await transcribe(tmp);
            if (!out) {
              send(res, 422, { error: "transcription unavailable" });
              return;
            }
            send(res, 200, out);
          } finally {
            try {
              unlinkSync(tmp);
            } catch {
              /* already gone */
            }
          }
          return;
        }

        if (req.method === "POST" && url.pathname === "/guardian/analyze") {
          let body: { events?: unknown };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 500) {
            send(res, 400, { error: "events[] with 1-500 entries required" });
            return;
          }
          const signals = detectSignals(body.events as Parameters<typeof detectSignals>[0]);
          if (signals.length === 0) {
            send(res, 200, { signals: [], investigation: null, mode: "clear" });
            return;
          }
          const investigation = await investigate(signals);
          send(res, 200, {
            signals,
            investigation,
            mode: investigation ? "investigated" : "signals-only",
          });
          return;
        }

        if (req.method === "POST" && url.pathname === "/guardian/respond") {
          let body: { action?: string; target?: string };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          if ((body.action !== "block_ip" && body.action !== "revoke_sessions" && body.action !== "rate_limit") || !body.target) {
            send(res, 400, { error: "action block_ip|revoke_sessions|rate_limit + target required" });
            return;
          }
          send(res, 200, simulateResponse(body.action, body.target));
          return;
        }

        if (req.method === "POST" && url.pathname === "/guardian/verify") {
          let body: { baselineSuspicious?: number; events?: unknown };
          try {
            body = JSON.parse(await readBody(req)) as typeof body;
          } catch {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          if (typeof body.baselineSuspicious !== "number" || !Array.isArray(body.events) || body.events.length > 500) {
            send(res, 400, { error: "baselineSuspicious number + events[] (max 500) required" });
            return;
          }
          send(res, 200, verifyContainment(body.baselineSuspicious, body.events as Parameters<typeof verifyContainment>[1]));
          return;
        }

        if (req.method === "GET" && url.pathname === "/guardian/sweeps") {
          send(res, 200, { sweeps: loadSweeps(acctData(req)).slice(-50) });
          return;
        }

        if (req.method === "POST" && url.pathname === "/guardian/sweep") {
          const parsed = await jsonBody(req);
          const t = liveTargets((parsed.ok ? parsed.body : {}) as { portalUrl?: string; engineUrl?: string });
          if (!t.portalUrl || !t.engineUrl) {
            send(res, 400, { error: "portalUrl + engineUrl required (body or PORTAL_URL/ENGINE_PUBLIC_URL env)" });
            return;
          }
          send(res, 200, await runSweep(t, acctData(req)));
          return;
        }

        if (req.method === "GET" && url.pathname === "/workorders") {
          send(res, 200, { workorders: loadWorkOrders(acctData(req)) });
          return;
        }

        if (req.method === "POST" && url.pathname === "/workorders") {
          const parsed = await jsonBody(req);
          if (!parsed.ok) {
            send(res, 400, { error: "invalid JSON body" });
            return;
          }
          const b = parsed.body as { title?: string; source?: string; sourceRef?: string; plan?: WorkOrderStep[] };
          const kinds = ["verify-fix", "re-analyze", "evidence-pack", "docs-note"];
          if (!b.title || !["guardian", "signals", "pentest", "manual"].includes(b.source ?? "") || !b.sourceRef ||
            !Array.isArray(b.plan) || b.plan.length === 0 || b.plan.length > 10 ||
            b.plan.some((p) => !kinds.includes(p.kind) || !p.label || !p.ref)) {
            send(res, 400, { error: "title, source guardian|signals|pentest|manual, sourceRef, plan[1..10] with kind/label/ref required" });
            return;
          }
          send(res, 201, createWorkOrder(acctData(req), {
            title: b.title,
            source: b.source as "guardian",
            sourceRef: b.sourceRef,
            plan: b.plan,
          }));
          return;
        }

        const woMatch = url.pathname.match(/^\/workorders\/([^/]+)(\/(approve|schedule))?$/);
        if (woMatch && ((req.method === "GET" && !woMatch[2]) || (req.method === "POST" && woMatch[2]))) {
          const wo = getWorkOrder(acctData(req), decodeURIComponent(woMatch[1]));
          if (!wo) {
            send(res, 404, { error: "unknown work order" });
            return;
          }
          if (req.method === "GET") {
            send(res, 200, wo);
            return;
          }
          try {
            if (woMatch[3] === "approve") {
              const parsed = await jsonBody(req);
              const by = (parsed.ok ? parsed.body.by : null) as string | undefined;
              send(res, 200, approveWorkOrder(acctData(req), wo.id, by?.trim() || "reviewer"));
            } else {
              const parsed = await jsonBody(req);
              const forRaw = (parsed.ok ? parsed.body.scheduledFor : null) as string | undefined;
              const scheduledFor = forRaw ?? new Date(Date.now() + 8 * 3600 * 1000).toISOString();
              send(res, 200, updateWorkOrder(acctData(req), wo.id, { status: "scheduled", scheduledFor }));
            }
          } catch (e) {
            send(res, 409, { error: (e as Error).message });
          }
          return;
        }

        if (req.method === "POST" && url.pathname === "/nightshift/run") {
          if (shiftRunning) {
            send(res, 429, { error: "a shift is already running" });
            return;
          }
          const parsed = await jsonBody(req);
          const b = (parsed.ok ? parsed.body : {}) as { orderIds?: string[]; portalUrl?: string; engineUrl?: string };
          const t = liveTargets(b);
          shiftRunning = true;
          try {
            const report = await runNightShift({
              dataRoot: acctData(req),
              reportsRoot: root,
              portalUrl: t.portalUrl,
              engineUrl: t.engineUrl,
              engineToken: secret("ENGINE_TOKEN") ?? undefined,
              orderIds: Array.isArray(b.orderIds) ? b.orderIds.map(String) : undefined,
              claimHeavy: () => {
                if (activeRuns >= 1) return false;
                activeRuns++;
                return true;
              },
              releaseHeavy: () => {
                activeRuns = Math.max(0, activeRuns - 1);
              },
            });
            send(res, 200, report);
          } catch (e) {
            send(res, 500, { error: (e as Error).message });
          } finally {
            shiftRunning = false;
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/nightshift/digests") {
          send(res, 200, { digests: loadDigests(acctData(req)).slice(-10) });
          return;
        }

        if (req.method === "POST" && url.pathname === "/signals/ingest") {
          const parsed = await jsonBody(req);
          const msgs = (parsed.ok ? parsed.body.messages : null) as Array<{ channel?: string; author?: string; text?: string }> | null;
          if (!parsed.ok || !Array.isArray(msgs) || msgs.length === 0 || msgs.length > 100 ||
            msgs.some((m) => !m.text || m.text.length > 4000)) {
            send(res, 400, { error: "messages[1..100] with text (max 4000 chars) required" });
            return;
          }
          const stamped: SignalMessage[] = msgs.map((m, i) => ({
            id: `sig_${Date.now().toString(36)}_${i}`,
            channel: (["support", "chat", "call", "review", "logs"].includes(m.channel ?? "") ? m.channel : "support") as SignalMessage["channel"],
            author: (m.author ?? "anonymous").slice(0, 120),
            text: m.text as string,
            ts: new Date().toISOString(),
          }));
          for (const m of stamped) {
            const g = await gradeMessage(m);
            m.sentiment = g.sentiment;
            if (g.theme) m.theme = g.theme;
          }
          const all = appendMessages(acctData(req), stamped);
          send(res, 201, { ingested: stamped.length, total: all.length, clusters: clusterMessages(all).slice(0, 12) });
          return;
        }

        if (req.method === "GET" && url.pathname === "/signals/clusters") {
          const all = loadMessages(acctData(req));
          send(res, 200, { total: all.length, clusters: clusterMessages(all).slice(0, 12) });
          return;
        }

        if (req.method === "POST" && url.pathname === "/signals/seed") {
          const stamped: SignalMessage[] = seedMessages().map((m, i) => ({
            ...m, id: `seed_${Date.now().toString(36)}_${i}`, ts: new Date().toISOString(),
          }));
          for (const m of stamped) {
            const g = await gradeMessage(m);
            m.sentiment = g.sentiment;
            if (g.theme) m.theme = g.theme;
          }
          const all = appendMessages(acctData(req), stamped);
          send(res, 201, { ingested: stamped.length, total: all.length, clusters: clusterMessages(all).slice(0, 12) });
          return;
        }

        if (req.method === "POST" && url.pathname === "/pentest/run") {
          const parsed = await jsonBody(req);
          const t = liveTargets((parsed.ok ? parsed.body : {}) as { portalUrl?: string; engineUrl?: string });
          if (!t.portalUrl || !t.engineUrl) {
            send(res, 400, { error: "portalUrl + engineUrl required (body or PORTAL_URL/ENGINE_PUBLIC_URL env)" });
            return;
          }
          const report = await runPentest({ ...t, engineToken: secret("ENGINE_TOKEN") ?? undefined });
          const pf = join(acctData(req), "pentest.json");
          let prior: unknown[] = [];
          try {
            prior = JSON.parse(readFileSync(pf, "utf8")) as unknown[];
          } catch {
            /* first report */
          }
          mkdirSync(acctData(req), { recursive: true });
          writeFileSync(pf, JSON.stringify([...prior, report].slice(-10), null, 2));
          send(res, 200, report);
          return;
        }

        if (req.method === "GET" && url.pathname === "/pentest/reports") {
          let reports: unknown[] = [];
          try {
            reports = JSON.parse(readFileSync(join(acctData(req), "pentest.json"), "utf8")) as unknown[];
          } catch {
            /* none yet */
          }
          send(res, 200, { reports });
          return;
        }

        function validTarget(raw: unknown): string | null {
          if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) return null;
          try {
            const u = new URL(raw);
            if (u.protocol !== "http:" && u.protocol !== "https:") return null;
            if (targetBlocked(raw)) return null;
            return raw;
          } catch {
            return null;
          }
        }

        function saveReport(file: string, report: unknown, inDir: string): void {
          const pf = join(inDir, file);
          let prior: unknown[] = [];
          try {
            prior = JSON.parse(readFileSync(pf, "utf8")) as unknown[];
          } catch {
            /* first report */
          }
          mkdirSync(inDir, { recursive: true });
          writeFileSync(pf, JSON.stringify([...prior, report].slice(-10), null, 2));
        }

        function loadReports(file: string, inDir: string): unknown[] {
          try {
            return JSON.parse(readFileSync(join(inDir, file), "utf8")) as unknown[];
          } catch {
            return [];
          }
        }

        if (req.method === "POST" && url.pathname === "/a11y/run") {
          const parsed = await jsonBody(req);
          const targetUrl = validTarget(parsed.ok ? parsed.body.targetUrl : null);
          if (!targetUrl) {
            send(res, 400, { error: "targetUrl must be a public http(s) URL" });
            return;
          }
          try {
            const report = await runA11y(targetUrl);
            saveReport("a11y.json", report, acctData(req));
            send(res, 200, report);
          } catch (e) {
            send(res, 502, { error: `accessibility run failed: ${(e as Error).message}` });
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/a11y/reports") {
          send(res, 200, { reports: loadReports("a11y.json", acctData(req)) });
          return;
        }

        if (req.method === "POST" && url.pathname === "/firstrun/run") {
          const parsed = await jsonBody(req);
          const targetUrl = validTarget(parsed.ok ? parsed.body.targetUrl : null);
          if (!targetUrl) {
            send(res, 400, { error: "targetUrl must be a public http(s) URL" });
            return;
          }
          try {
            const report = await runFirstRun(targetUrl);
            saveReport("firstrun.json", report, acctData(req));
            send(res, 200, report);
          } catch (e) {
            send(res, 502, { error: `first run failed: ${(e as Error).message}` });
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/firstrun/reports") {
          send(res, 200, { reports: loadReports("firstrun.json", acctData(req)) });
          return;
        }

        if (req.method === "POST" && url.pathname === "/guardian/logwatch") {
          const parsed = await jsonBody(req);
          const raw = (parsed.ok ? parsed.body.projectId : null) as string | undefined;
          const projectId = (raw && raw.trim()) || process.env.GCP_PROJECT_ID || "";
          if (!projectId) {
            send(res, 400, { error: "projectId required (body or GCP_PROJECT_ID env)" });
            return;
          }
          try {
            const report = await runLogWatch(projectId);
            saveReport("logwatch.json", report, acctData(req));
            if (report.configured && report.groups.length > 0) {
              const stamped: SignalMessage[] = report.groups.slice(0, 5).map((g, i) => ({
                id: `lw_${Date.now().toString(36)}_${i}`,
                channel: "logs",
                author: `log-watch:${g.service}`,
                text: `${g.count}x in 60m: ${g.signature}. Sample: ${g.sample.slice(0, 200)}`,
                ts: new Date().toISOString(),
              }));
              for (const m of stamped) {
                const gr = await gradeMessage(m);
                m.sentiment = gr.sentiment;
                if (gr.theme) m.theme = gr.theme;
              }
              appendMessages(acctData(req), stamped);
            }
            send(res, 200, report);
          } catch (e) {
            send(res, 502, { error: `log watch failed: ${(e as Error).message}` });
          }
          return;
        }

        if (req.method === "GET" && url.pathname === "/guardian/logwatch") {
          const reports = loadReports("logwatch.json", acctData(req));
          send(res, 200, { report: reports.at(-1) ?? null });
          return;
        }

        if (req.method === "GET" && url.pathname === "/zoom/status") {
          send(res, 200, await zoomStatus());
          return;
        }

        if (req.method === "POST" && url.pathname === "/zoom/join") {
          const parsed = await jsonBody(req);
          const meetingUrl = (parsed.ok ? parsed.body.meetingUrl : null) as string | undefined;
          if (!meetingUrl) {
            send(res, 400, { error: "meetingUrl required" });
            return;
          }
          try {
            send(res, 201, await joinMeeting(meetingUrl));
          } catch (e) {
            const msg = (e as Error).message;
            send(res, msg.includes("not configured") ? 501 : 400, { error: msg });
          }
          return;
        }

        const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
        if (req.method === "GET" && runMatch) {
          const runId = decodeURIComponent(runMatch[1]);
          let status = runStatus(runId);
          if (status === "failed" && !jobs.has(runId)) {
            // Another instance (or a restart) may have produced this run:
            // pull it down from GCS before declaring it unknown.
            await ensureRunLocal(root, runId);
            status = runStatus(runId);
          }
          if (status === "failed" && !jobs.has(runId) && !existsSync(join(root, runId))) {
            send(res, 404, { error: "unknown run" });
            return;
          }
          const out: Record<string, unknown> = { runId, status };
          if (status === "done") {
            out.findings = JSON.parse(readFileSync(join(root, runId, "findings.json"), "utf8"));
            const vpath = join(root, runId, "verification.json");
            if (existsSync(vpath)) out.verification = JSON.parse(readFileSync(vpath, "utf8"));
            const rpath = join(root, runId, "report.md");
            if (existsSync(rpath)) out.report = readFileSync(rpath, "utf8");
          }
          if (status === "failed") out.error = jobs.get(runId)?.error ?? "run failed";
          send(res, 200, out);
          return;
        }

        const artMatch = url.pathname.match(/^\/runs\/([^/]+)\/artifacts\/(.+)$/);
        if (req.method === "GET" && artMatch) {
          const runId = decodeURIComponent(artMatch[1]);
          const rel = artMatch[2].split("/").map(decodeURIComponent);
          const base = join(root, runId) + sep;
          let full = normalize(join(root, runId, ...rel));
          if (!full.startsWith(base)) {
            send(res, 404, { error: "not found" });
            return;
          }
          if (!existsSync(full)) await ensureRunLocal(root, runId);
          full = normalize(join(root, runId, ...rel));
          if (!existsSync(full) || !statSync(full).isFile()) {
            send(res, 404, { error: "not found" });
            return;
          }
          send(res, 200, readFileSync(full), mimeOf(full));
          return;
        }

        send(res, 404, { error: "not found" });
      } catch (e) {
        send(res, 500, { error: (e as Error).message });
      }
    })();
  };
}
