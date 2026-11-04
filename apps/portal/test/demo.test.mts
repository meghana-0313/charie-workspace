import assert from "node:assert/strict";
import { buildDemoSeed, DEMO_UID } from "../lib/demo";
import { isDemoAccount, sampleA11yReports, sampleBriefs, sampleClusters, sampleDigests, sampleFindings, sampleFirstRunReports, sampleLogWatch, samplePentestReports, sampleSweeps, sampleWorkOrders, sampleZoom } from "../lib/demo-samples";
import { localRunTargets } from "../lib/guardian";

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
for (const project of ["Demo Site", "TravelMate", "WorkBoard"]) assert.match(subjects, new RegExp(project), `project ${project} present`);
assert.ok(seed.incidents.every((i) => i.simulated === true), "sample incidents are labelled simulated");
assert.ok(seed.builds.every((b) => /simulated/i.test(b.detail ?? "")), "sample builds are labelled simulated");
assert.ok(seed.schedules.length >= 4, "autopilot has sample schedules for every kind");
assert.ok(seed.connectors.length >= 2 && seed.syncRules.every((r) => seed.connectors.some((c) => c.id === r.connectorId)), "integrations have sample connectors and a rule that points at one");
assert.ok(seed.contextDocs.length >= 2, "integrations have sample context docs");
assert.ok(seed.chatThread.messages.length >= 2 && seed.chatThread.uid === DEMO_UID, "chat has a sample thread");
assert.ok(seed.seats.length >= 3 && seed.seats.every((s) => s.id.startsWith("demo-")), "team page has sample seats scoped to demo ids (demo is admin over samples only)");

// Engine-backed surfaces: every page that reads from the engine must have
// a labelled demo fallback, so no demo page renders empty.
assert.ok(isDemoAccount(DEMO_UID) && !isDemoAccount("someone-else"), "demo fallback is scoped to the demo account only");
for (const [name, list] of [["a11y", sampleA11yReports()], ["firstrun", sampleFirstRunReports()], ["pentest", samplePentestReports()], ["sweeps", sampleSweeps()], ["workorders", sampleWorkOrders()], ["digests", sampleDigests()]] as const) {
  assert.ok(list.length >= 1, `demo ${name} sample is non-empty`);
  assert.match(JSON.stringify(list), /[Ss]ample/, `demo ${name} sample is labelled as sample data`);
}
assert.ok(sampleClusters().clusters.length >= 1, "signals page has sample clusters");
const digestText = sampleDigests()[0]?.digest ?? "";
assert.match(digestText, /checkout/i, "night shift digest names the actual sample work");
assert.match(digestText, /grade B/i, "night shift digest reports the sample security grade");
assert.ok(!digestText.includes("run a live scan to replace this"), "night shift digest is real sample content, not a placeholder line");
assert.ok(seed.contextDocs.some((d) => /uploaded sample/i.test(d.title)), "a sample upload stands in for user-provided docs and points scans at the demo store");
for (const r of [...sampleA11yReports(), ...sampleFirstRunReports(), ...samplePentestReports()]) {
  assert.ok(typeof r.executor === "string" && r.executor.length > 5, "every sample scan report names its executor for the after-scan tooltip");
}
assert.ok(sampleLogWatch().groups.length >= 1, "guardian page has a sample logwatch");
assert.match(sampleZoom().provider, /[Ss]imulated/, "zoom sample is labelled simulated");
for (const run of seed.runs) {
  assert.ok((sampleFindings(run.id) ?? []).length >= 1, `demo run ${run.id} has sample findings`);
}
assert.ok(sampleBriefs("demo-run-shopflow-checkout").length >= 1, "UX page has a sample redesign brief");
const localTargets = localRunTargets("http://localhost:3103") as { portalUrl?: string; engineUrl?: string };
assert.equal(localTargets.engineUrl, "http://localhost:3103", "local pentest/night-shift runs get the engine target they need");
assert.match(localTargets.portalUrl ?? "", /3102/, "local runs get the portal target they need");
assert.deepEqual(localRunTargets("https://engine.example.run.app"), {}, "hosted engines keep their configured environment targets");

console.log("demo: all assertions passed");
