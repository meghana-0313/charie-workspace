import { test } from "node:test";
import assert from "node:assert/strict";
import { charieAskLine, charieShouldReply, meetRoomStatus } from "../lib/room-status.ts";

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
