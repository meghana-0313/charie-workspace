import assert from "node:assert/strict";
import { isScreenSeeQuestion, screenVisionReply } from "../lib/room-status";

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

console.log("room-status tests passed");
