// Firestore clean(): undefined is stripped recursively (Firestore rejects it
// anywhere, including nested in arrays like chat messages). Regression for
// the chat turn 500 in hosted mode: a user message without attachments.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { clean, firestorePatch } = await import("../lib/store-firestore.ts");

describe("firestore clean", () => {
  it("strips top-level undefined", () => {
    assert.deepEqual(clean({ a: 1, b: undefined }), { a: 1 });
  });

  it("strips undefined nested in arrays of objects", () => {
    const doc = {
      id: "chat_1",
      messages: [
        { role: "user", text: "hi", attachments: undefined, at: "t" },
        { role: "assistant", text: "yo", model: "heuristic", actions: [], at: "t" },
      ],
    };
    assert.deepEqual(clean(doc), {
      id: "chat_1",
      messages: [
        { role: "user", text: "hi", at: "t" },
        { role: "assistant", text: "yo", model: "heuristic", actions: [], at: "t" },
      ],
    });
  });

  it("keeps real values, nulls, and nested attachment objects", () => {
    const doc = { messages: [{ text: "x", attachments: [{ name: "a.png", meta: { w: 3, h: undefined } }] }], note: null };
    assert.deepEqual(clean(doc), { messages: [{ text: "x", attachments: [{ name: "a.png", meta: { w: 3 } }] }], note: null });
  });
});

describe("firestorePatch (reopen regression)", () => {
  it("turns undefined patch values into field deletes, keeping real values", () => {
    const out = firestorePatch({ endedAt: undefined, title: "Room" }, "2026-01-01T00:00:00.000Z");
    assert.equal(out.title, "Room");
    assert.equal(out.updatedAt, "2026-01-01T00:00:00.000Z");
    assert.ok(out.endedAt !== undefined, "endedAt must be a delete sentinel, not stripped");
    assert.equal(typeof (out.endedAt as { isEqual?: unknown }).isEqual, "function");
  });
});
