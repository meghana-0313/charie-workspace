import { test } from "node:test";
import assert from "node:assert/strict";
import { CHARIE_SPEECH_RATE, charieAskLine, charieShouldReply, meetRoomStatus, speakableText, transcriptStamp } from "../lib/room-status.ts";
import { consentCard, needsConsent } from "../lib/consent.ts";
import { isRepeatSpeech, type LiveLine } from "../lib/livecall.ts";

test("transcript stamp shows full date and time per line", () => {
  const s = transcriptStamp("2026-11-04T17:22:31.000Z");
  assert.match(s, /2026/);
  assert.match(s, /Nov/);
  assert.match(s, /\d{2}:\d{2}:\d{2}/);
  assert.equal(transcriptStamp("not-a-date"), "");
});

test("Charie never repeats a line she already said in the call", () => {
  const now = Date.parse("2026-11-04T21:26:00.000Z");
  const agent = (text: string, at: string): LiveLine => ({ speaker: "Charie", role: "agent", text, at });
  const prior = [
    agent("I see the Meta Model API Usage page with current usage, weekly limit and a spend graph showing around 1.1K rupees.", "2026-11-04T21:25:40.000Z"),
    agent("Doing well, thanks for asking - how can I help today?", "2026-11-04T21:25:10.000Z"),
  ];
  assert.equal(isRepeatSpeech(prior, "I see the Meta Model API Usage page with current usage, weekly limit and a spend graph showing around 1.1K rupees.", 180000, now), true, "verbatim repeat dropped");
  assert.equal(isRepeatSpeech(prior, "I see your Meta Model API Usage page showing current usage and about 1.1K rupees in pay as you go spend.", 180000, now), true, "same-lead re-description dropped");
  assert.equal(isRepeatSpeech(prior, "That spike looks like normal usage volume on November 3rd, not an error.", 180000, now), false, "a genuinely new answer is allowed");
  assert.equal(isRepeatSpeech(prior, "Doing well, thanks for asking - how can I help today?", 180000, Date.parse("2026-11-04T21:35:00.000Z")), false, "outside the window it may be said again");
});

test("Charie speaks at a brisk conversational pace on every voice path", () => {
  assert.ok(CHARIE_SPEECH_RATE >= 1.1 && CHARIE_SPEECH_RATE <= 1.3, "faster than default, still intelligible");
});

test("room without endedAt is Open", () => {
  assert.equal(meetRoomStatus({}), "Open");
  assert.equal(meetRoomStatus({ endedAt: undefined }), "Open");
});

test("room with endedAt is Ended (rooms list must not label it open)", () => {
  assert.equal(meetRoomStatus({ endedAt: "2026-11-02T10:00:00.000Z" }), "Ended");
});

test("Charie replies to direct questions and when addressed by name", () => {
  assert.equal(charieShouldReply("Why is checkout failing?"), true);
  assert.equal(charieShouldReply("Charie, please check the logs"), true);
  assert.equal(charieShouldReply("charie can you summarise that"), true);
});

test("Charie stays silent for ordinary statements (no reply spam)", () => {
  assert.equal(charieShouldReply("I deployed the fix ten minutes ago."), false);
  assert.equal(charieShouldReply("Let us move to the next topic."), false);
});

test("typed Ask Charie lines always address Charie (same path as a chat message)", () => {
  assert.equal(charieAskLine("why is checkout failing"), "Charie, why is checkout failing");
  assert.equal(charieAskLine("Charie, check the logs"), "Charie, check the logs");
  assert.equal(charieAskLine("  "), "");
  assert.equal(charieShouldReply(charieAskLine("summarise the call")), true);
});

test("speakableText strips markdown, links and ids a voice must not read aloud", () => {
  assert.equal(speakableText("See **this** https://x.test/a for tkt_abc123"), "See this the link in the chat for that ticket");
  assert.equal(speakableText("Open /tickets/tkt_abc123 now"), "Open the page in the workspace now");
});

test("side-effect chat tools need consent, read-only tools do not", () => {
  assert.equal(needsConsent("file_ticket"), true);
  assert.equal(needsConsent("start_scan"), true);
  assert.equal(needsConsent("list_tickets"), false);
  assert.equal(needsConsent("ticket_status"), false);
  assert.equal(consentCard("file_ticket", { targetUrl: "https://x.test" }).status, "pending");
});
