import { test } from "node:test";
import assert from "node:assert/strict";
import { PEER_TIMEOUT_MS, stalePeerIds, touchPeer } from "../lib/presence.ts";

test("peer seen recently is not stale", () => {
  const seen = { a: 1000 };
  assert.deepEqual(stalePeerIds(seen, 1000 + PEER_TIMEOUT_MS - 1), []);
});

test("peer silent past the timeout is stale (ghost tile cleanup)", () => {
  const seen = { a: 1000, b: 5000 };
  assert.deepEqual(stalePeerIds(seen, 1000 + PEER_TIMEOUT_MS + 1), ["a"]);
});

test("touchPeer records the sighting without mutating the input", () => {
  const seen = { a: 1 };
  const next = touchPeer(seen, "b", 42);
  assert.deepEqual(seen, { a: 1 });
  assert.deepEqual(next, { a: 1, b: 42 });
});

test("custom timeout is honored", () => {
  assert.deepEqual(stalePeerIds({ a: 0 }, 100, 50), ["a"]);
  assert.deepEqual(stalePeerIds({ a: 0 }, 100, 500), []);
});
