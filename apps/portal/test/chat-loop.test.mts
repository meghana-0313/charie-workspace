import assert from "node:assert/strict";
import { isRepeatCall, summarizeToolResults, toolSignature } from "../lib/chat-loop";

// A repeated tool call with identical args must be detected so the chat
// loop can stop instead of burning every turn on help/help/help.
assert.equal(toolSignature("help", {}), toolSignature("help", {}));
assert.notEqual(toolSignature("help", {}), toolSignature("list_tickets", {}));
assert.notEqual(toolSignature("ticket_status", { ticketId: "tkt_a" }), toolSignature("ticket_status", { ticketId: "tkt_b" }));
const seen = new Set<string>([toolSignature("help", {})]);
assert.equal(isRepeatCall(seen, "help", {}), true);
assert.equal(isRepeatCall(seen, "repo_status", {}), false);

// When the model never produces a final text reply, the portal synthesizes
// an answer from the tool results it actually collected - and it must never
// be the old dead end.
const answer = summarizeToolResults([
  { tool: "help", result: "I can: list tickets and their status, run scans." },
  { tool: "repo_status", result: "No connected repos. Connect one on /repos." },
  { tool: "list_tickets", result: "tkt_a - Checkout broken - open" },
]);
assert.match(answer, /list tickets/i);
assert.match(answer, /No connected repos/i);
assert.match(answer, /Checkout broken/);
assert.doesNotMatch(answer, /ran out of steps/i);
assert.doesNotMatch(summarizeToolResults([]), /ran out of steps/i);

console.log("chat-loop: all assertions passed");
