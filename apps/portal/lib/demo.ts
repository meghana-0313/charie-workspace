// Demo Mode: a public, no-login workspace with coherent sample data.
// One reserved uid owns every demo record, so the normal per-account
// scoping is the isolation boundary: demo visitors can only ever see
// and change demo data, production accounts and integrations are
// untouched. Sample records are seeded once, progress is saved in the
// same store as real data (local files or Firestore), and Reset
// restores the seed. Simulated integrations are labelled as simulated.

import { store } from "./store";
import type { ChatThread, Connector, ContextDoc, Incident, MeetRoom, PortalRun, RepoBuild, RepoConnection, Room, Schedule, SyncRule, Ticket } from "./types";

export const DEMO_UID = "demo-workspace";
export const DEMO_EMAIL = "demo@charie.local";
export const DEMO_NAME = "Demo Guest";

export function isDemoUid(uid: string | undefined | null): boolean {
  return uid === DEMO_UID;
}

const DAY = 24 * 3600 * 1000;
function daysAgo(now: number, days: number): string {
  return new Date(now - days * DAY).toISOString();
}

export interface DemoSeed {
  tickets: Ticket[];
  rooms: Room[];
  runs: PortalRun[];
  messages: Array<{ roomId: string; body: string }>;
  incidents: Incident[];
  repos: RepoConnection[];
  builds: RepoBuild[];
  schedules: Schedule[];
  connectors: Connector[];
  syncRules: SyncRule[];
  contextDocs: ContextDoc[];
  chatThread: ChatThread;
}

/** Pure seed builder (tested): every run points at a real ticket and room. */
export function buildDemoSeed(nowMs: number = Date.now()): DemoSeed {
  const t = (days: number) => daysAgo(nowMs, days);
  const projects = {
    shopflow: "http://localhost:3101",
    travelmate: "https://demo.charie.local/travelmate",
    workboard: "https://demo.charie.local/workboard",
  };
  const defs: Array<{ key: string; project: string; target: string; subject: string; body: string; status: Ticket["status"]; runId?: string; days: number }> = [
    { key: "checkout", project: "ShopFlow", target: projects.shopflow, subject: "ShopFlow: checkout cart total is wrong and payment fails", body: "Customers report the cart total changes at checkout and valid cards are rejected. Project: ShopFlow (demo target, runs locally at http://localhost:3101).", status: "verified", runId: "demo-run-shopflow-checkout", days: 6 },
    { key: "registration", project: "ShopFlow", target: projects.shopflow, subject: "ShopFlow: registration form rejects valid email addresses", body: "New users with valid emails see a validation error and cannot register. Project: ShopFlow.", status: "fix-proposed", runId: "demo-run-shopflow-registration", days: 5 },
    { key: "search", project: "ShopFlow", target: projects.shopflow, subject: "ShopFlow: search filters return unrelated products", body: "Filtering by category shows products from other categories. Project: ShopFlow.", status: "in-room", runId: "demo-run-shopflow-search", days: 4 },
    { key: "a11y", project: "ShopFlow", target: projects.shopflow, subject: "ShopFlow: checkout button unreachable by keyboard", body: "Keyboard users cannot reach the checkout button. Project: ShopFlow.", status: "verified", days: 3 },
    { key: "booking", project: "TravelMate", target: projects.travelmate, subject: "TravelMate: booking flow loses the selected hotel", body: "After payment simulation the trip shows a different hotel. Simulated target (demo adapter). Project: TravelMate.", status: "closed", runId: "demo-run-travelmate-booking", days: 8 },
    { key: "session", project: "TravelMate", target: projects.travelmate, subject: "TravelMate: session times out during payment", body: "Users are logged out mid-payment. Simulated target (demo adapter). Project: TravelMate.", status: "verified", days: 7 },
    { key: "notify", project: "WorkBoard", target: projects.workboard, subject: "WorkBoard: task assignment sends no notification", body: "Assignees never learn they got a task. Simulated target (demo adapter). Project: WorkBoard.", status: "new", days: 1 },
    { key: "upload", project: "WorkBoard", target: projects.workboard, subject: "WorkBoard: file upload fails silently over 5 MB", body: "Large attachments vanish without an error. Simulated target (demo adapter). Project: WorkBoard.", status: "investigating", days: 2 },
  ];
  const tickets: Ticket[] = [];
  const rooms: Room[] = [];
  const runs: PortalRun[] = [];
  const messages: DemoSeed["messages"] = [];
  for (const d of defs) {
    const ticketId = `demo-tkt-${d.key}`;
    const roomId = `demo-room-${d.key}`;
    tickets.push({
      id: ticketId, uid: DEMO_UID, subject: d.subject, body: d.body,
      goal: d.subject.replace(/^[^:]+: /, ""), targetUrl: d.target,
      status: d.status, roomId, createdAt: t(d.days), updatedAt: t(Math.max(0, d.days - 1)),
    });
    rooms.push({ id: roomId, ticketId, title: d.subject, status: d.status === "closed" ? "resolved" : "open", runIds: d.runId ? [d.runId] : [], createdAt: t(d.days) });
    if (d.runId) {
      runs.push({ id: d.runId, uid: DEMO_UID, ticketId, roomId, kind: "investigate", targetUrl: d.target, status: "done", createdAt: t(d.days) });
    }
    messages.push({ roomId, body: `Sample demo record for ${d.project}. Charie's investigation summary and findings are in the linked report. Live runs you start yourself use the real engine and real Meta models.` });
  }
  const incidents: Incident[] = [
    {
      id: "demo-inc-stuffing", uid: DEMO_UID, title: "Credential stuffing burst on /login (simulated sample)", severity: "blocker", status: "open",
      signals: [{ type: "auth-stuffing", severity: "blocker", title: "1200 failed logins in 10 minutes", evidence: ["Sample signal from the demo dataset, not a live attack"], actors: ["botnet-sample"], ips: ["203.0.113.7"] }],
      investigation: { verdict: "Simulated sample incident for judging", severity: "blocker", summary: "This seeded incident shows the Guard verdict layout. Run Simulate attack on the Threats page for a live flow.", timeline: ["Sample: failed-login rate crossed threshold", "Sample: detector grouped the burst"], plan: ["Approve a response to see the work-order flow"], disagreement: null, glimmerFiltered: 3 },
      mode: "investigated", baselineSuspicious: 12, actions: [], simulated: true, createdAt: t(2), updatedAt: t(2),
    },
    {
      id: "demo-inc-api", uid: DEMO_UID, title: "API abuse pattern on /api/export (simulated sample)", severity: "major", status: "contained",
      signals: [{ type: "api-abuse", severity: "major", title: "Export endpoint scraped at 40x baseline", evidence: ["Sample signal from the demo dataset"], actors: ["sample-actor"], ips: ["198.51.100.23"] }],
      investigation: { verdict: "Simulated sample incident for judging", severity: "major", summary: "Seeded so the incident page is never empty in Demo Mode.", timeline: ["Sample: export rate anomaly"], plan: ["Rate-limit rule proposed in the sample"], disagreement: null, glimmerFiltered: 1 },
      mode: "investigated", baselineSuspicious: 4, actions: [], simulated: true, createdAt: t(5), updatedAt: t(4),
    },
  ];
  const repos: RepoConnection[] = [{
    id: "demo-repo-shopflow", uid: DEMO_UID, owner: "circle-back", repo: "demo-shopflow", branch: "main", subdir: "", startCommand: "npm run dev",
    visibility: "public", hasToken: false, status: "live", lastSha: "demo5eed", appUrl: "http://localhost:3101",
    createdAt: t(9), updatedAt: t(1),
  }];
  const builds: RepoBuild[] = [
    { id: "demo-build-2", repoId: "demo-repo-shopflow", sha: "demo5eed", cloudBuildId: "simulated", strategy: "node", status: "deployed", appUrl: "http://localhost:3101", detail: "Demo integration - simulated build record. Production Mode uses real Cloud Build.", createdAt: t(1), updatedAt: t(1) },
    { id: "demo-build-1", repoId: "demo-repo-shopflow", sha: "demo01d", cloudBuildId: "simulated", strategy: "node", status: "failure", detail: "Demo integration - simulated build record: checkout test failed, ticket auto-filed.", createdAt: t(3), updatedAt: t(3) },
  ];
  const schedules: Schedule[] = [
    { id: "demo-sched-sweep", uid: DEMO_UID, kind: "sweep", preset: "daily", enabled: true, lastRunAt: t(1), lastStatus: "ok (sample)", createdAt: t(9), updatedAt: t(1) },
    { id: "demo-sched-pentest", uid: DEMO_UID, kind: "pentest", preset: "weekly", enabled: true, lastRunAt: t(4), lastStatus: "ok (sample)", createdAt: t(9), updatedAt: t(4) },
    { id: "demo-sched-nightshift", uid: DEMO_UID, kind: "nightshift", preset: "daily", enabled: true, lastRunAt: t(1), lastStatus: "ok (sample): 1 verified, 1 scheduled", createdAt: t(9), updatedAt: t(1) },
    { id: "demo-sched-logwatch", uid: DEMO_UID, kind: "logwatch", preset: "hourly", enabled: false, lastRunAt: t(2), lastStatus: "paused (sample)", createdAt: t(9), updatedAt: t(2) },
  ];
  const connectors: Connector[] = [
    { id: "demo-conn-jira", uid: DEMO_UID, kind: "jira", name: "Jira (simulated sample)", status: "connected", detail: "Simulated connector for Demo Mode - no real Jira is contacted.", config: { domain: "sample.atlassian.net" }, lastSyncAt: t(1), lastSyncStatus: "ok (sample): 2 issues imported", createdAt: t(9), updatedAt: t(1) },
    { id: "demo-conn-github", uid: DEMO_UID, kind: "github", name: "GitHub (simulated sample)", status: "connected", detail: "Simulated connector for Demo Mode - builds are sample records.", config: {}, lastSyncAt: t(1), lastSyncStatus: "ok (sample)", createdAt: t(9), updatedAt: t(1) },
  ];
  const syncRules: SyncRule[] = [
    { id: "demo-rule-jira-shopflow", uid: DEMO_UID, connectorId: "demo-conn-jira", kind: "jira-pull", project: "SHOP", targetUrl: projects.shopflow, preset: "daily", enabled: true, importedKeys: ["SHOP-101 (sample)", "SHOP-102 (sample)"], lastRunAt: t(1), lastStatus: "ok (sample)", createdAt: t(9), updatedAt: t(1) },
  ];
  const contextDocs: ContextDoc[] = [
    { id: "demo-doc-runbook", uid: DEMO_UID, title: "ShopFlow demo runbook (sample)", source: "note", body: "Sample context doc. Checkout totals must match the cart after coupons; keyboard users must reach checkout; uploads over 5 MB need a clear error. Demo Mode data - edit or delete freely.", createdAt: t(8), updatedAt: t(2) },
    { id: "demo-doc-release", uid: DEMO_UID, title: "Release notes (sample)", source: "note", body: "Sample context doc. TravelMate and WorkBoard are simulated targets in Demo Mode; ShopFlow runs against the local demo target.", createdAt: t(8), updatedAt: t(3) },
    { id: "demo-doc-upload", uid: DEMO_UID, title: "ShopFast demo store - uploaded sample brief", source: "note", body: "Sample upload standing in for a user-provided brief or SDK doc. Target under test: the ShopFast demo store at http://localhost:3101 (npm run demo:target), seeded with intentional bugs: checkout returns 500 with 3 or more items, the Place order control is not keyboard reachable, three inputs are placeholder-only, and security headers are missing. Every sample scan and investigation in this workspace runs against that store until you point Charie at your own URL.", createdAt: t(8), updatedAt: t(1) },
  ];
  const chatThread: ChatThread = {
    id: "demo-thread-welcome", uid: DEMO_UID, title: "Demo workspace tour (sample)",
    messages: [
      { role: "user", text: "Hey! What can you do, how is my system health, and how many calls did Charie assist this week?", at: t(1) },
      { role: "assistant", text: "Sample thread from the demo seed. I can list tickets and check status, read findings, file tickets that investigate themselves, run accessibility / first-run / security scans and UX reviews, list autopilot schedules, and check repo builds. Ask me in Chat and I will answer from this workspace.", model: "heuristic", at: t(1) },
    ],
    createdAt: t(1), updatedAt: t(1),
  };
  return { tickets, rooms, runs, messages, incidents, repos, builds, schedules, connectors, syncRules, contextDocs, chatThread };
}

async function applySeed(seed: DemoSeed): Promise<void> {
  // Top-up only: records a demo visitor already has (or edited) are never
  // overwritten. This is what lets new sample data reach demo workspaces
  // seeded by an older build - the previous version returned early as
  // soon as any ticket existed, so later seed additions never arrived.
  const [haveTickets, haveIncidents, haveRepos, haveSchedules, haveConnectors, haveRules, haveDocs, haveThreads] = await Promise.all([
    store.listTickets(DEMO_UID).catch(() => []),
    store.listIncidents(DEMO_UID).catch(() => []),
    store.listRepos(DEMO_UID).catch(() => []),
    store.listSchedules(DEMO_UID).catch(() => []),
    store.listConnectors(DEMO_UID).catch(() => []),
    store.listSyncRules(DEMO_UID).catch(() => []),
    store.listContextDocs(DEMO_UID).catch(() => []),
    store.listThreads(DEMO_UID).catch(() => []),
  ]);
  const have = (list: Array<{ id: string }>) => new Set(list.map((x) => x.id));
  const ticketIds = have(haveTickets);
  for (const ticket of seed.tickets) if (!ticketIds.has(ticket.id)) await store.saveTicket(ticket);
  const roomIds = new Set<string>();
  for (const ticket of haveTickets) if (ticket.roomId) roomIds.add(ticket.roomId);
  for (const room of seed.rooms) if (!roomIds.has(room.id)) await store.saveRoom(room);
  const haveRuns = new Set((await store.listRuns(50, DEMO_UID).catch(() => [])).map((r) => r.id));
  for (const run of seed.runs) {
    if (haveRuns.has(run.id)) continue;
    await store.createRun({ id: run.id, ticketId: run.ticketId, roomId: run.roomId, kind: run.kind, targetUrl: run.targetUrl, uid: DEMO_UID }).catch(() => {});
    await store.setRunStatus(run.id, "done").catch(() => {});
  }
  for (const m of seed.messages) {
    const existing = await store.listMessages(m.roomId).catch(() => []);
    if (existing.length === 0) {
      await store.addMessage(m.roomId, { authorType: "agent", authorName: "Charie", body: m.body }).catch(() => {});
    }
  }
  const incidentIds = have(haveIncidents);
  for (const inc of seed.incidents) if (!incidentIds.has(inc.id)) await store.saveIncident(inc);
  const repoIds = have(haveRepos);
  for (const repo of seed.repos) if (!repoIds.has(repo.id)) await store.saveRepo(repo);
  for (const repo of seed.repos) {
    const builds = await store.listBuilds(repo.id).catch(() => []);
    const buildIds = new Set(builds.map((b) => b.id));
    for (const build of seed.builds) if (build.repoId === repo.id && !buildIds.has(build.id)) await store.saveBuild(build);
  }
  const scheduleIds = have(haveSchedules);
  for (const s of seed.schedules) if (!scheduleIds.has(s.id)) await store.saveSchedule(s);
  const connectorIds = have(haveConnectors);
  for (const c of seed.connectors) if (!connectorIds.has(c.id)) await store.saveConnector(c).catch(() => {});
  const ruleIds = have(haveRules);
  for (const r of seed.syncRules) if (!ruleIds.has(r.id)) await store.saveSyncRule(r).catch(() => {});
  const docIds = have(haveDocs);
  for (const d of seed.contextDocs) if (!docIds.has(d.id)) await store.saveContextDoc(d).catch(() => {});
  if (!have(haveThreads).has(seed.chatThread.id)) await store.saveThread(seed.chatThread).catch(() => {});
  const rooms = await store.listMeetRooms(DEMO_UID).catch(() => []);
  if (rooms.length === 0) {
    const room = await store.createMeetRoom({ title: "ShopFlow checkout help - sample call", createdBy: DEMO_NAME, uid: DEMO_UID });
    await store.updateMeetRoom(room.id, {
      endedAt: new Date(Date.now() - DAY).toISOString(),
      transcript: [
        { speaker: "Customer (sample)", role: "teammate", text: "Checkout shows a different total than my cart.", at: new Date(Date.now() - DAY).toISOString() },
        { speaker: "Charie", role: "agent", text: "I can see the mismatch on your shared screen. The cart says 2,499 and checkout says 2,899 - a stale shipping fee is being added twice.", at: new Date(Date.now() - DAY).toISOString() },
        { speaker: "Customer (sample)", role: "teammate", text: "What should I click?", at: new Date(Date.now() - DAY).toISOString() },
        { speaker: "Charie", role: "agent", text: "Remove the coupon and re-add it once - that clears the duplicate fee. I am watching the total as you do it.", at: new Date(Date.now() - DAY).toISOString() },
      ],
      screenLog: [
        { at: new Date(Date.now() - DAY).toISOString(), text: "Checkout page: cart total 2,499, checkout total 2,899, duplicate shipping fee visible." },
      ],
      notes: ["Sample call seeded for Demo Mode. Live calls record real transcripts."],
      summary: "Sample support call: Charie saw the shared screen, found a duplicated shipping fee, and guided the fix live.",
    } satisfies Partial<MeetRoom>);
  }
}

/** Seed the demo workspace. Safe on every demo entry: applySeed tops up
 *  whatever an older build left missing and never overwrites edits. */
export async function ensureDemoWorkspace(): Promise<void> {
  await applySeed(buildDemoSeed());
}

/** Restore the original seeded dataset. Demo data only, by uid. */
export async function resetDemoWorkspace(): Promise<void> {
  await store.clearDemoData(DEMO_UID);
  await applySeed(buildDemoSeed());
}

