// Ingest key lifecycle: mint, verify, revoke, reject. File store mode only;
// runs against the local .data folder and leaves the test key revoked.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_KEY = "test-key-for-sessions";
delete process.env.PORTAL_STORE;

const keys = await import("../lib/keys.ts");
const { store } = await import("../lib/store.ts");

describe("api keys", () => {
  it("verifies a live key and rejects it once revoked", async () => {
    const { record, secret } = await keys.mintApiKey("test-revoked-key");
    assert.match(secret, /^chp_[0-9a-f]{8}_[0-9a-f]{32}$/);
    const live = await keys.verifyApiKey(secret);
    assert.equal(live?.id, record.id);
    await store.saveApiKey({ ...record, revoked: true });
    assert.equal(await keys.verifyApiKey(secret), null);
  });
  it("rejects malformed and unknown keys", async () => {
    assert.equal(await keys.verifyApiKey(""), null);
    assert.equal(await keys.verifyApiKey("chp_deadbeef_00000000000000000000000000000000"), null);
    assert.equal(await keys.verifyApiKey("not-a-key"), null);
  });
});
