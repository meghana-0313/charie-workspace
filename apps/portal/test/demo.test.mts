import assert from "node:assert/strict";
import { buildDemoSeed, DEMO_UID } from "../lib/demo";

// Demo seed must be internally consistent: judges click through it.
const seed = buildDemoSeed(Date.parse("2026-11-04T10:00:00.000Z"));
assert.ok(seed.tickets.length >= 6, "at least three sample projects worth of tickets");
assert.ok(seed.tickets.every((t) => t.uid === DEMO_UID), "every demo ticket is owned by the demo uid (isolation)");
const roomIds = new Set(seed.rooms.map((r) => r.id));
const ticketIds = new Set(seed.tickets.map((t) => t.id));
for (const run of seed.runs) {
  assert.ok(ticketIds.has(run.ticketId), `run ${run.id} points at a seeded ticket`);
  assert.ok(roomIds.has(run.roomId), `run ${run.id} points at a seeded room`);
  assert.equal(run.uid, DEMO_UID);
}
for (const room of seed.rooms) {
  assert.ok(ticketIds.has(room.ticketId), `room ${room.id} points at a seeded ticket`);
  for (const runId of room.runIds) assert.ok(seed.runs.some((r) => r.id === runId), `room run ${runId} exists`);
}
const subjects = seed.tickets.map((t) => t.subject).join(" ");
for (const project of ["ShopFlow", "TravelMate", "WorkBoard"]) assert.match(subjects, new RegExp(project), `project ${project} present`);
assert.ok(seed.incidents.every((i) => i.simulated === true), "sample incidents are labelled simulated");
assert.ok(seed.builds.every((b) => /simulated/i.test(b.detail ?? "")), "sample builds are labelled simulated");

console.log("demo: all assertions passed");
