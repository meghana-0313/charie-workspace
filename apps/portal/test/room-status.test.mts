import assert from "node:assert/strict";
import { clampCallReply, isEchoOfAgent, isScreenHistoryQuestion, isScreenSeeQuestion, screenHistoryReply, screenQuestionTime, screenVisionReply, shortVisionConfirm, splitSpeakChunks } from "../lib/room-status";

// Screen questions are detected so they never reach a free-form model guess.
assert.equal(isScreenSeeQuestion("Sorry, can you see my screen?"), true);
assert.equal(isScreenSeeQuestion("Cheryl, I'm actually sharing my screen. Can you not see it?"), true);
assert.equal(isScreenSeeQuestion("What are you looking at actually?"), true);
assert.equal(isScreenSeeQuestion("Can you hear me?"), false);
assert.equal(isScreenSeeQuestion("Checkout is broken again"), false);

// Without a captured frame, Charie must say she cannot see - never claim vision.
const blind = screenVisionReply(null);
assert.match(blind, /can't see your screen/i);
assert.doesNotMatch(blind, /I can see it now/i);

// With a real captured frame, she may describe exactly that frame.
const seen = screenVisionReply("A checkout page with a red payment error banner.", "2026-11-03T10:32:00.000Z", "2026-11-03T10:32:05.000Z");
assert.match(seen, /I can see/i);
assert.match(seen, /payment error/);
const stale = screenVisionReply("An old settings page.", "2026-11-03T10:30:00.000Z", "2026-11-03T10:32:05.000Z");
assert.match(stale, /may be behind/i);
assert.match(stale, /seconds ago/i);

// Screen-history questions answer from the recorded log, never invented.
assert.equal(isScreenHistoryQuestion("What happened at 10:32?"), true);
assert.equal(isScreenHistoryQuestion("What was on the screen earlier?"), true);
assert.equal(isScreenHistoryQuestion("Can you see my screen?"), false);
assert.equal(screenQuestionTime("what happened at 9:05?"), "09:05");
assert.equal(screenQuestionTime("what happened earlier?"), null);
const log = [
  { at: "2026-11-03T10:30:00.000Z", text: "Checkout page, payment form visible." },
  { at: "2026-11-03T10:32:10.000Z", text: "Red error banner: card declined." },
];
assert.match(screenHistoryReply(log, "10:32", "2026-11-03T11:00:00.000Z"), /card declined/);
assert.match(screenHistoryReply(log, "08:00", "2026-11-03T11:00:00.000Z"), /no frame from 08:00/i);
assert.match(screenHistoryReply([], null, "2026-11-03T11:00:00.000Z"), /no screen memory/i);
assert.match(screenHistoryReply(log, null, "2026-11-03T11:00:00.000Z"), /10:32/);

// Spoken replies split into sentence chunks so playback starts early.
assert.deepEqual(splitSpeakChunks("One. Two! Three? Four"), ["One. Two! Three? Four"]);
const long = splitSpeakChunks(`${"A very long sentence about the checkout failure and what caused it. ".repeat(3)}Short tail.`);
assert.ok(long.length >= 2 && long[0].length <= 170, "long replies split into early-playable chunks");
assert.deepEqual(splitSpeakChunks("Just one sentence"), ["Just one sentence"]);
assert.deepEqual(splitSpeakChunks("  "), []);
assert.ok(splitSpeakChunks("A. B. C. D. E. F. G. H.").length <= 5);
const clauses = splitSpeakChunks("The checkout failed at the payment step, the card was declined by the bank, and the order never got created for the customer.");
assert.ok(clauses[0].length <= 75, "first spoken chunk is one short clause so her voice starts fast");

const confirm = shortVisionConfirm("Your Usage page shows a 1.1K rupee spike on November 3rd. No error visible. Click Billing next.");
assert.match(confirm, /same screen/i);
assert.ok(!confirm.includes("Click Billing"), "confirmation never re-reads the whole frame");

// Spoken call replies answer only what was asked: at most two sentences,
// never a paragraph of extra narration, however verbose the model was.
assert.equal(clampCallReply("Checkout is failing at payment. The card is being declined. Also your dashboard looks outdated and you should really redesign the settings page soon."), "Checkout is failing at payment. The card is being declined.");
assert.equal(clampCallReply("Just the answer."), "Just the answer.");
assert.equal(clampCallReply(""), "");
assert.ok(clampCallReply("One very long explanation ".repeat(30)).length <= 263, "long single-sentence replies are capped for speech");

// Echo: her own voice through the speakers must never become a
// "teammate" line or trigger her reactions (the self-talk loop).
const agentSaid = [
  "Hi, I'm Charie. I'm listening in and will flag anything I can debug. I won't run anything without your approval.",
  "That sounds like a real failure. I can investigate it live if you approve the card on the right.",
  "I see the City travel passes page with four products and your cart is empty. There is no error or blocker showing right now.",
];
assert.equal(isEchoOfAgent("Hey hi Cherry. Hi I'm Cherry, I'm listening in and will flag anything I can debug.", agentSaid), true);
assert.equal(isEchoOfAgent("That sounds like a real failure I can investigate it live if you.", agentSaid), true);
assert.equal(isEchoOfAgent("There is no error or blocker showing right now.", agentSaid), true);
assert.equal(isEchoOfAgent("Shari, I'm sharing my screen, can you say it?", agentSaid), false);
assert.equal(isEchoOfAgent("Hello. How are you doing Cherry?", agentSaid), false);
assert.equal(isEchoOfAgent("Can you run a pentest on the demo site?", agentSaid), false);

console.log("room-status tests passed");
