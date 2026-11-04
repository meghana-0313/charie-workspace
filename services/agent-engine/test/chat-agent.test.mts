// Charie chat turn: Spark reply parsing, heuristic router, key fallback.
// Offline: scripted model replies (fake-model style). Run: npm run test.
import { strict as assert } from "node:assert";
import { chatTurn, heuristicTurn, parseTurnReply } from "../src/chat-agent.js";
import type { ChatTurn } from "../src/chat-agent.js";
import { _clearSecretCache } from "../src/secrets.js";

let n = 0;
const ok = (cond: unknown, msg: string) => { n++; assert.ok(cond, msg); };
const u = (content: string): ChatTurn => ({ role: "user", content });

// --- parseTurnReply: strict shape, one action per turn ---
const t1 = parseTurnReply('{"tool": "list_tickets", "args": {}}');
ok(t1.kind === "tool" && t1.tool === "list_tickets", "tool call parses");
const t2 = parseTurnReply('thinking...\n{"tool": "ticket_status", "args": {"ticketId": "tkt_x"}} trailing');
ok(t2.kind === "tool" && t2.tool === "ticket_status" && (t2.args as Record<string, string>).ticketId === "tkt_x", "embedded tool JSON parses");
const t3 = parseTurnReply('{"text": "hello there"}');
ok(t3.kind === "text" && t3.text === "hello there", "text reply parses");
const t4 = parseTurnReply("no json here");
ok(t4.kind === "text" && (t4.text ?? "").length > 0, "garbage becomes clarification");
const t5 = parseTurnReply('{"tool": "delete_everything", "args": {}}');
ok(t5.kind === "text", "unknown tool rejected");
const t6 = parseTurnReply('{"tool": "help", "args": [1, 2]}');
ok(t6.kind === "tool" && t6.tool === "help" && typeof t6.args === "object", "array args normalized to object");
const t7 = parseTurnReply('{"tool": "help"}');
ok(t7.kind === "tool" && t7.tool === "help", "missing args default to {}");
const t8 = parseTurnReply('{"text": "   "}');
ok(t8.kind === "text" && (t8.text ?? "").includes("could not parse"), "blank text rejected");
const tSalvage = parseTurnReply('The run failed because the target timed out {see logs} and nothing was filed.');
ok(tSalvage.kind === "text" && (tSalvage.text ?? "").includes("target timed out") && !(tSalvage.text ?? "").includes("could not parse"), "prose with braces is salvaged, never a parse dead-end");

// --- heuristicTurn: keyword router with the same contract ---
ok(heuristicTurn([u("help")]).tool === "help", "help routes");
ok(heuristicTurn([u("what is the status of tkt_abc123?")]).tool === "ticket_status", "ticket id routes to status");
ok(heuristicTurn([u("show findings for tkt_abc123")]).tool === "get_findings", "findings intent routes");
ok(heuristicTurn([u("run an accessibility scan on https://x.test")]).tool === "start_scan", "a11y+url routes to scan");
ok(heuristicTurn([u("file a bug about login https://x.test/app")]).tool === "file_ticket", "file+url routes");
const needUrl = heuristicTurn([u("file a ticket about the checkout bug")]);
ok(needUrl.kind === "text" && (needUrl.text ?? "").includes("URL"), "file without url asks for it");
ok(heuristicTurn([u("list my tickets")]).tool === "list_tickets", "tickets routes");
ok(heuristicTurn([u("what schedules do I have")]).tool === "list_schedules", "schedules routes");
ok(heuristicTurn([u("how is my repo build doing")]).tool === "repo_status", "repos routes");
ok(heuristicTurn([u("scan https://x.test for security issues")]).tool === "start_scan", "security scan routes");
const noUrlScans = heuristicTurn([u("can you do a first run or accessibility run or ux & redesign run?")]);
ok(noUrlScans.kind === "text" && /URL/.test(noUrlScans.text ?? "") && /accessibility/i.test(noUrlScans.text ?? "") && /first-run/i.test(noUrlScans.text ?? "") && /UX/i.test(noUrlScans.text ?? "") && !(noUrlScans.text ?? "").includes("could not parse"), "scan/UX question without a URL asks for the URL and names all three options");
const noUrlA11y = heuristicTurn([u("can you do an accessibility run?")]);
ok(noUrlA11y.kind === "text" && /URL/.test(noUrlA11y.text ?? ""), "accessibility run without a URL asks for the URL instead of scanning");
const demoScan = heuristicTurn([u("run a sample test")], "http://localhost:3101");
ok(demoScan.kind === "tool" && demoScan.tool === "start_scan" && String((demoScan.args as Record<string, unknown>).targetUrl) === "http://localhost:3101", "demo sample test without a URL runs against the demo target");
const demoA11y = heuristicTurn([u("can you do an accessibility run?")], "http://localhost:3101");
ok(demoA11y.kind === "tool" && demoA11y.tool === "start_scan" && (demoA11y.args as Record<string, unknown>).kind === "a11y", "demo accessibility ask without a URL scans the demo target, not ask for one");
const uxWithUrl = heuristicTurn([u("do a ux & redesign run on https://x.test/app")]);
ok(uxWithUrl.kind === "tool" && uxWithUrl.tool === "file_ticket" && String((uxWithUrl.args as Record<string, unknown>).targetUrl) === "https://x.test/app" && /UX review/i.test(String((uxWithUrl.args as Record<string, unknown>).subject)), "UX run with a URL files a UX review ticket, not a scan kind");
const seen = heuristicTurn([u("status?"), { role: "tool", content: "2 open tickets" }]);
ok(seen.kind === "text", "post-tool turn summarizes");
const seenHelp = heuristicTurn([u("status?"), { role: "tool", content: "[help] I can: list tickets and run scans." }]);
ok(seenHelp.kind === "text" && !(seenHelp.text ?? "").startsWith("[help]") && (seenHelp.text ?? "").includes("list tickets"), "tool label plumbing never leaks into the user-visible answer");
const retry = heuristicTurn([
  u("run an accessibility report on the connected demo site?"),
  { role: "assistant", content: "I can do that, but I will not run it without your say-so. Run a scan: a11y - http://localhost:3101. Approve the card below and I will run it." },
  { role: "assistant", content: "Done. Engine unreachable. Try again in a bit." },
  u("try now"),
]);
ok(retry.kind === "tool" && retry.tool === "start_scan" && (retry.args as Record<string, unknown>).kind === "a11y" && String((retry.args as Record<string, unknown>).targetUrl) === "http://localhost:3101", "try now after a failed scan re-issues that scan, never help");

// --- chatTurn: key present uses Spark, missing key falls back ---
delete process.env.META_API_KEY;
_clearSecretCache();
const h = await chatTurn({ history: [u("list my tickets")] });
ok(h.kind === "tool" && h.model === "heuristic", "no key means heuristic");
const forcedMeta = await chatTurn({ history: [u("list my tickets")], model: "meta" });
ok(forcedMeta.kind === "text" && forcedMeta.model === "none" && /META_API_KEY/.test(forcedMeta.text ?? ""), "forcing Meta with no key says unavailable, never silently heuristic");
const whereReport = heuristicTurn([
  u("hey can you run a pen test suite?"),
  { role: "assistant", content: "Done. Security re-scan: grade C, 33/35 checks. Details on /guardian/security." },
  u("where can i find its report?"),
]);
ok(whereReport.kind === "text" && /guardian\/security/.test(whereReport.text ?? "") && whereReport.tool !== "repo_status", "where-is-the-pentest-report answers from the product map, not the repo lookup");
ok(heuristicTurn([u("where can i find its report?")]).kind === "text", "report location question without context still answers with the reports index");

process.env.META_API_KEY = "fake-test-key";
const sparkReply = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"tool": "list_schedules", "args": {}}' } }] }), { status: 200 });
const s = await chatTurn({ history: [u("any schedules?")], fetchImpl: sparkReply as typeof fetch });
ok(s.kind === "tool" && s.tool === "list_schedules" && s.model.includes("muse-spark"), "scripted Spark reply drives a tool");
let callMaxTokens = 0;
const capFetch = async (_url: unknown, init?: { body?: string }) => {
  try { callMaxTokens = (JSON.parse(String(init?.body ?? "{}")) as { max_tokens?: number }).max_tokens ?? 0; } catch { /* keep 0 */ }
  return new Response(JSON.stringify({ choices: [{ message: { content: "{\"text\": \"On it.\"}" } }] }), { status: 200 });
};
const mc = await chatTurn({ history: [u("what do you see?")], snapshot: { surface: "meet-call" }, fetchImpl: capFetch as typeof fetch });
ok(mc.kind === "text" && callMaxTokens > 0 && callMaxTokens <= 1200, "meet-call replies cap reasoning tokens at 1200 so spoken answers stay fast");
const garbled = async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
const g = await chatTurn({ history: [u("can you do a first run or accessibility run or ux & redesign run?")], fetchImpl: garbled as typeof fetch });
ok(g.kind === "text" && /URL/.test(g.text ?? "") && !(g.text ?? "").includes("could not parse"), "unparseable model reply falls back to the heuristic answer, never a parse dead-end");
const boom = async () => { throw new Error("network down"); };
const f = await chatTurn({ history: [u("list my tickets")], fetchImpl: boom as typeof fetch });
ok(f.kind === "tool" && f.model === "heuristic", "Spark failure falls back to heuristic");
const forcedBaseten = await chatTurn({ history: [u("list my tickets")], model: "baseten", fetchImpl: boom as typeof fetch });
ok(forcedBaseten.kind === "text" && forcedBaseten.model === "none" && /BASETEN_API_KEY/.test(forcedBaseten.text ?? ""), "forcing Baseten with no Baseten key says unavailable, never silently heuristic");
delete process.env.META_API_KEY;


// --- Baseten Muse Spark Open powers chat when its key is present ---
delete process.env.META_API_KEY;
process.env.BASETEN_API_KEY = "fake-baseten-key";
_clearSecretCache();
let seenUrl = "";
const basetenReply = async (url: unknown) => { seenUrl = String(url); return new Response(JSON.stringify({ choices: [{ message: { content: '{"text": "On it, checking now."}' } }] }), { status: 200 }); };
const b = await chatTurn({ history: [u("hello Charie")], fetchImpl: basetenReply as typeof fetch });
ok(b.kind === "text" && b.model.includes("baseten"), "Baseten key means Baseten Muse Spark Open drives chat");
ok(seenUrl.includes("inference.baseten.co"), "chat went to the Baseten endpoint, not Meta");
delete process.env.BASETEN_API_KEY;
_clearSecretCache();

const t9 = parseTurnReply("Hey! I am doing great, thanks for asking. How can I help?");
ok(t9.kind === "text" && (t9.text ?? "").includes("doing great"), "plain conversational reply is an answer, not a parse error");
const t10 = parseTurnReply('{"text": "The capital of France is Paris."}');
ok(t10.kind === "text" && (t10.text ?? "").includes("Paris"), "general question answer parses");

console.log(`chat-agent: ${n} assertions passed`);
