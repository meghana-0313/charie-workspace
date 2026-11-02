import { test } from "node:test";
import assert from "node:assert/strict";
import { charieAskLine, charieShouldReply, meetRoomStatus, speakableText } from "../lib/room-status.ts";
import { consentCard, needsConsent } from "../lib/consent.ts";

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
