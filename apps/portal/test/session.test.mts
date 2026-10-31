// Portal session + invite round trips (HMAC cookies, no Firebase needed).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_KEY = "test-key-for-sessions";

const auth = await import("../lib/auth.ts");
const { automationKeyOk, checkInvite, devLoginAllowed, mintInvite, mintSession, sessionIdentity } = auth;

describe("session cookie", () => {
  it("round trips an identity", () => {
    const id = { uid: "u1", email: "a@b.c", name: "Al" };
    const back = sessionIdentity(mintSession(id));
    assert.deepEqual(back, id);
  });
  it("rejects tampered payloads", () => {
    const c = mintSession({ uid: "u1", email: "a@b.c", name: "Al" }).split(".");
    c[1] = Buffer.from(JSON.stringify({ uid: "hacker", email: "", name: "" })).toString("hex");
    assert.equal(sessionIdentity(c.join(".")), null);
  });
  it("rejects expired cookies", () => {
    const RealDate = Date;
    const c = mintSession({ uid: "u1", email: "", name: "" });
    (globalThis as { Date: unknown }).Date = class extends RealDate {
      static now() { return new RealDate("2030-01-01").getTime(); }
    };
    try {
      assert.equal(sessionIdentity(c), null);
    } finally {
      (globalThis as { Date: unknown }).Date = RealDate;
    }
  });
  it("rejects legacy two-part cookies", () => {
    assert.equal(sessionIdentity(`${Date.now() + 1000}.deadbeef`), null);
  });
  it("rejects garbage", () => {
    assert.equal(sessionIdentity(undefined), null);
    assert.equal(sessionIdentity(""), null);
    assert.equal(sessionIdentity("a.b.c.d"), null);
  });
});

describe("guest invites", () => {
  it("round trips for the right room only", () => {
    const t = mintInvite("room1");
    assert.equal(checkInvite("room1", t), true);
    assert.equal(checkInvite("room2", t), false);
    assert.equal(checkInvite("room1", "room1.999.abc"), false);
    assert.equal(checkInvite("room1", null), false);
  });
});

describe("automation key + dev login", () => {
  it("automation key is off when unset, strict when set", () => {
    delete process.env.AUTOMATION_KEY;
    assert.equal(automationKeyOk("anything"), false);
    process.env.AUTOMATION_KEY = "k123";
    assert.equal(automationKeyOk("k123"), true);
    assert.equal(automationKeyOk("k124"), false);
    assert.equal(automationKeyOk(undefined), false);
    delete process.env.AUTOMATION_KEY;
  });
  it("dev login follows the store mode", () => {
    delete process.env.PORTAL_STORE;
    assert.equal(devLoginAllowed(), true);
    process.env.PORTAL_STORE = "firestore";
    assert.equal(devLoginAllowed(), false);
    delete process.env.PORTAL_STORE;
  });
});
