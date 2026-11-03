import assert from "node:assert/strict";
import { isScreenHistoryQuestion, isScreenSeeQuestion, screenHistoryReply, screenQuestionTime, screenVisionReply, splitSpeakChunks } from "../lib/room-status";

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
const seen = screenVisionReply("A checkout page with a red payment error banner.");
assert.match(seen, /last frame shared with me/i);
assert.match(seen, /payment error/);

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
assert.ok(splitSpeakChunks("A. B. C. D. E. F. G. H.").length <= 4);

console.log("room-status tests passed");
