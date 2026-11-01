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
const seen = heuristicTurn([u("status?"), { role: "tool", content: "2 open tickets" }]);
ok(seen.kind === "text", "post-tool turn summarizes");

// --- chatTurn: key present uses Spark, missing key falls back ---
delete process.env.META_API_KEY;
_clearSecretCache();
const h = await chatTurn({ history: [u("list my tickets")] });
ok(h.kind === "tool" && h.model === "heuristic", "no key means heuristic");

process.env.META_API_KEY = "fake-test-key";
const sparkReply = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"tool": "list_schedules", "args": {}}' } }] }), { status: 200 });
const s = await chatTurn({ history: [u("any schedules?")], fetchImpl: sparkReply as typeof fetch });
ok(s.kind === "tool" && s.tool === "list_schedules" && s.model.includes("muse-spark"), "scripted Spark reply drives a tool");
const boom = async () => { throw new Error("network down"); };
const f = await chatTurn({ history: [u("list my tickets")], fetchImpl: boom as typeof fetch });
ok(f.kind === "tool" && f.model === "heuristic", "Spark failure falls back to heuristic");
delete process.env.META_API_KEY;

console.log(`chat-agent: ${n} assertions passed`);
