// JSON-file store: local stand-in for Firestore. Same async interface as
// store-firestore.ts - see lib/store.ts for the selector.
// Data lives in apps/portal/.data (gitignored).

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ApiKey, Approval, ChatThread, Connector, ContextDoc, GithubToken, GuardEventView, Incident, MeetRoom, MeetSignal, PortalRun, PushSubscription, RepoBuild, RepoConnection, Room, RoomMessage, Schedule, SyncRule, TeamSeat, Ticket } from "./types";
import { uid } from "./uid";

const DATA = join(process.cwd(), ".data");
mkdirSync(DATA, { recursive: true });

function file<T>(name: string, fallback: T): { read(): T; write(v: T): void } {
  const path = join(DATA, `${name}.json`);
  return {
    read(): T {
      if (!existsSync(path)) return fallback;
      try {
        return JSON.parse(readFileSync(path, "utf8")) as T;
      } catch {
        return fallback;
      }
    },
    write(v: T) {
      writeFileSync(path, JSON.stringify(v, null, 2));
    },
  };
}

const tickets = file<Record<string, Ticket>>("tickets", {});
const rooms = file<Record<string, Room>>("rooms", {});
const messages = file<Record<string, RoomMessage[]>>("messages", {});
const approvals = file<Record<string, Approval[]>>("approvals", {});
const runs = file<Record<string, PortalRun>>("runs", {});
const gevents = file<GuardEventView[]>("guardian-events", []);
const incidents = file<Record<string, Incident>>("incidents", {});
const pushSubs = file<Record<string, PushSubscription>>("push", {});
const repos = file<Record<string, RepoConnection>>("repos", {});
const builds = file<Record<string, RepoBuild>>("builds", {});
const meetRooms = file<Record<string, MeetRoom>>("meet-rooms", {});
const meetSignals = file<Record<string, MeetSignal[]>>("meet-signals", {});
const seats = file<Record<string, TeamSeat>>("team-seats", {});
const apiKeys = file<Record<string, ApiKey>>("api-keys", {});
const schedules = file<Record<string, Schedule>>("schedules", {});
const ghTokens = file<Record<string, GithubToken>>("github-tokens", {});
const settings = file<Record<string, string>>("settings", {});
const threads = file<Record<string, ChatThread>>("chat-threads", {});
const connectors = file<Record<string, Connector>>("connectors", {});
const syncRules = file<Record<string, SyncRule>>("sync-rules", {});
const contextDocs = file<Record<string, ContextDoc>>("context-docs", {});

const now = () => new Date().toISOString();

/** Per-account visibility: no uid filter sees everything; legacy records
 *  without uid stay visible to their whole team. */
function mine<T extends { uid?: string }>(rows: T[], filterUid?: string): T[] {
  if (!filterUid) return rows;
  return rows.filter((r) => !r.uid || r.uid === filterUid);
}

export const fileStore = {
  async listTickets(filterUid?: string): Promise<Ticket[]> {
    return mine(Object.values(tickets.read()), filterUid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getTicket(id: string): Promise<Ticket | null> {
    return tickets.read()[id] ?? null;
  },
  async createTicket(input: { subject: string; body: string; goal: string; targetUrl: string; voiceNotePath?: string; sourceRepo?: string; uid?: string }): Promise<Ticket> {
    const all = tickets.read();
    const ticket: Ticket = { ...input, id: uid("tkt"), status: "new", createdAt: now(), updatedAt: now() };
    all[ticket.id] = ticket;
    tickets.write(all);
    const r = rooms.read();
    const room: Room = {
      id: uid("room"), ticketId: ticket.id, title: ticket.subject,
      status: "open", runIds: [], createdAt: now(),
    };
    r[room.id] = room;
    rooms.write(r);
    ticket.roomId = room.id;
    ticket.status = "in-room";
    ticket.updatedAt = now();
    all[ticket.id] = ticket;
    tickets.write(all);
    return ticket;
  },
  async setTicketStatus(id: string, status: Ticket["status"]): Promise<void> {
    const all = tickets.read();
    if (all[id]) {
      all[id].status = status;
      all[id].updatedAt = now();
      tickets.write(all);
    }
  },

  async getRoom(id: string): Promise<Room | null> {
    return rooms.read()[id] ?? null;
  },
  async getRoomByTicket(ticketId: string): Promise<Room | null> {
    return Object.values(rooms.read()).find((r) => r.ticketId === ticketId) ?? null;
  },
  async addRunToRoom(roomId: string, runId: string): Promise<void> {
    const r = rooms.read();
    if (r[roomId] && !r[roomId].runIds.includes(runId)) {
      r[roomId].runIds.push(runId);
      rooms.write(r);
    }
  },
  async listMessages(roomId: string): Promise<RoomMessage[]> {
    return messages.read()[roomId] ?? [];
  },
  async addMessage(roomId: string, input: { authorType: "human" | "agent"; authorName: string; body: string; findingIds?: string[] }): Promise<RoomMessage> {
    const all = messages.read();
    const msg: RoomMessage = { ...input, findingIds: input.findingIds ?? [], id: uid("msg"), createdAt: now() };
    all[roomId] = [...(all[roomId] ?? []), msg];
    messages.write(all);
    return msg;
  },

  async listApprovals(roomId: string): Promise<Approval[]> {
    return approvals.read()[roomId] ?? [];
  },
  async addApproval(roomId: string, input: { findingIds: string[]; instruction: string; approvedBy: string }): Promise<Approval> {
    const all = approvals.read();
    const a: Approval = { ...input, id: uid("appr"), status: "approved", createdAt: now() };
    all[roomId] = [...(all[roomId] ?? []), a];
    approvals.write(all);
    return a;
  },
  async setApprovalStatus(roomId: string, approvalId: string, status: Approval["status"]): Promise<Approval | null> {
    const all = approvals.read();
    const list = all[roomId] ?? [];
    const i = list.findIndex((a) => a.id === approvalId);
    if (i < 0) return null;
    list[i] = { ...list[i], status };
    all[roomId] = list;
    approvals.write(all);
    return list[i];
  },

  async getRun(id: string): Promise<PortalRun | null> {
    return runs.read()[id] ?? null;
  },
  async createRun(input: Omit<PortalRun, "status" | "createdAt">): Promise<PortalRun> {
    const all = runs.read();
    const run: PortalRun = { ...input, status: "running", createdAt: now() };
    all[run.id] = run;
    runs.write(all);
    return run;
  },
  async setRunStatus(id: string, status: PortalRun["status"]): Promise<void> {
    const all = runs.read();
    if (all[id]) {
      all[id].status = status;
      runs.write(all);
    }
  },
  async listRuns(limit = 20, filterUid?: string): Promise<PortalRun[]> {
    return mine(Object.values(runs.read()), filterUid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  async saveEvents(events: GuardEventView[]): Promise<void> {
    gevents.write([...gevents.read(), ...events].slice(-1000));
  },
  async listRecentEvents(limit = 200): Promise<GuardEventView[]> {
    return gevents.read().slice(-limit);
  },
  async saveIncident(inc: Incident): Promise<void> {
    const all = incidents.read();
    all[inc.id] = inc;
    incidents.write(all);
  },
  async getIncident(id: string): Promise<Incident | null> {
    return incidents.read()[id] ?? null;
  },
  async listIncidents(): Promise<Incident[]> {
    return Object.values(incidents.read()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async updateIncident(id: string, patch: Partial<Incident>): Promise<void> {
    const all = incidents.read();
    if (all[id]) {
      all[id] = { ...all[id], ...patch, updatedAt: now() };
      incidents.write(all);
    }
  },

  async savePushSubscription(sub: Omit<PushSubscription, "createdAt">): Promise<void> {
    const all = pushSubs.read();
    all[sub.endpoint] = { ...sub, createdAt: now() };
    pushSubs.write(all);
  },
  async listPushSubscriptions(): Promise<PushSubscription[]> {
    return Object.values(pushSubs.read());
  },
  async deletePushSubscription(endpoint: string): Promise<void> {
    const all = pushSubs.read();
    delete all[endpoint];
    pushSubs.write(all);
  },

  async listRepos(filterUid?: string): Promise<RepoConnection[]> {
    return mine(Object.values(repos.read()), filterUid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getRepo(id: string): Promise<RepoConnection | null> {
    return repos.read()[id] ?? null;
  },
  async saveRepo(repo: RepoConnection): Promise<void> {
    const all = repos.read();
    all[repo.id] = repo;
    repos.write(all);
  },
  async updateRepo(id: string, patch: Partial<RepoConnection>): Promise<void> {
    const all = repos.read();
    if (all[id]) {
      all[id] = { ...all[id], ...patch, updatedAt: now() };
      repos.write(all);
    }
  },
  async deleteRepo(id: string): Promise<void> {
    const all = repos.read();
    delete all[id];
    repos.write(all);
  },

  async listBuilds(repoId: string): Promise<RepoBuild[]> {
    return Object.values(builds.read())
      .filter((b) => b.repoId === repoId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getBuild(id: string): Promise<RepoBuild | null> {
    return builds.read()[id] ?? null;
  },
  async saveBuild(build: RepoBuild): Promise<void> {
    const all = builds.read();
    all[build.id] = build;
    builds.write(all);
  },
  async updateBuild(id: string, patch: Partial<RepoBuild>): Promise<void> {
    const all = builds.read();
    if (all[id]) {
      all[id] = { ...all[id], ...patch, updatedAt: now() };
      builds.write(all);
    }
  },

  async listMeetRooms(filterUid?: string): Promise<MeetRoom[]> {
    return mine(Object.values(meetRooms.read()), filterUid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getMeetRoom(id: string): Promise<MeetRoom | null> {
    return meetRooms.read()[id] ?? null;
  },
  async createMeetRoom(input: { title: string; createdBy: string; uid?: string }): Promise<MeetRoom> {
    const all = meetRooms.read();
    const room: MeetRoom = { ...input, id: uid("meet"), seq: 0, createdAt: now(), updatedAt: now() };
    all[room.id] = room;
    meetRooms.write(all);
    return room;
  },
  async postMeetSignal(roomId: string, input: { from: string; to: string; kind: MeetSignal["kind"]; payload: string }): Promise<MeetSignal> {
    const rooms = meetRooms.read();
    const room = rooms[roomId];
    if (!room) throw new Error("unknown room");
    room.seq += 1;
    room.updatedAt = now();
    rooms[roomId] = room;
    meetRooms.write(rooms);
    const all = meetSignals.read();
    const sig: MeetSignal = { ...input, seq: room.seq, roomId, createdAt: now() };
    all[roomId] = [...(all[roomId] ?? []), sig].slice(-200);
    meetSignals.write(all);
    return sig;
  },
  async listMeetSignals(roomId: string, since: number): Promise<MeetSignal[]> {
    return (meetSignals.read()[roomId] ?? []).filter((s) => s.seq > since);
  },

  async listSeats(): Promise<TeamSeat[]> {
    return Object.values(seats.read()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async getSeatByEmail(email: string): Promise<TeamSeat | null> {
    return Object.values(seats.read()).find((s) => s.email.toLowerCase() === email.toLowerCase()) ?? null;
  },
  async saveSeat(seat: TeamSeat): Promise<void> {
    const all = seats.read();
    all[seat.id] = seat;
    seats.write(all);
  },
  async deleteSeat(id: string): Promise<void> {
    const all = seats.read();
    delete all[id];
    seats.write(all);
  },
  async linkSeatLogin(id: string, link: { uid: string; name: string }): Promise<void> {
    const all = seats.read();
    if (all[id]) {
      all[id].uid = link.uid;
      all[id].name = link.name;
      all[id].lastLoginAt = now();
      seats.write(all);
    }
  },

  async listApiKeys(filterUid?: string): Promise<ApiKey[]> {
    return mine(Object.values(apiKeys.read()), filterUid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getApiKeyByPrefix(prefix: string): Promise<ApiKey | null> {
    return Object.values(apiKeys.read()).find((k) => k.prefix === prefix && !k.revoked) ?? null;
  },
  async saveApiKey(key: ApiKey): Promise<void> {
    const all = apiKeys.read();
    all[key.id] = key;
    apiKeys.write(all);
  },
  async touchApiKey(id: string): Promise<void> {
    const all = apiKeys.read();
    if (all[id]) {
      all[id].lastUsedAt = now();
      apiKeys.write(all);
    }
  },

  async listSchedules(filterUid?: string): Promise<Schedule[]> {
    return mine(Object.values(schedules.read()), filterUid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async getSchedule(id: string): Promise<Schedule | null> {
    return schedules.read()[id] ?? null;
  },
  async saveSchedule(s: Schedule): Promise<void> {
    const all = schedules.read();
    all[s.id] = s;
    schedules.write(all);
  },
  async deleteSchedule(id: string): Promise<void> {
    const all = schedules.read();
    delete all[id];
    schedules.write(all);
  },

  async getGithubToken(filterUid: string): Promise<GithubToken | null> {
    return ghTokens.read()[filterUid] ?? null;
  },
  async saveGithubToken(t: GithubToken): Promise<void> {
    const all = ghTokens.read();
    all[t.uid] = t;
    ghTokens.write(all);
  },
  async deleteGithubToken(filterUid: string): Promise<void> {
    const all = ghTokens.read();
    delete all[filterUid];
    ghTokens.write(all);
  },

  async listThreads(filterUid?: string): Promise<ChatThread[]> {
    return mine(Object.values(threads.read()), filterUid)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getThread(id: string): Promise<ChatThread | null> {
    return threads.read()[id] ?? null;
  },
  async saveThread(t: ChatThread): Promise<void> {
    const all = threads.read();
    all[t.id] = t;
    threads.write(all);
  },
  async deleteThread(id: string): Promise<void> {
    const all = threads.read();
    delete all[id];
    threads.write(all);
  },

  async listConnectors(filterUid?: string): Promise<Connector[]> {
    return mine(Object.values(connectors.read()), filterUid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async getConnector(id: string): Promise<Connector | null> {
    return connectors.read()[id] ?? null;
  },
  async saveConnector(c: Connector): Promise<void> {
    const all = connectors.read();
    all[c.id] = c;
    connectors.write(all);
  },
  async deleteConnector(id: string): Promise<void> {
    const all = connectors.read();
    delete all[id];
    connectors.write(all);
  },

  async listSyncRules(filterUid?: string): Promise<SyncRule[]> {
    return mine(Object.values(syncRules.read()), filterUid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async getSyncRule(id: string): Promise<SyncRule | null> {
    return syncRules.read()[id] ?? null;
  },
  async saveSyncRule(r: SyncRule): Promise<void> {
    const all = syncRules.read();
    all[r.id] = r;
    syncRules.write(all);
  },
  async deleteSyncRule(id: string): Promise<void> {
    const all = syncRules.read();
    delete all[id];
    syncRules.write(all);
  },

  async listContextDocs(filterUid?: string): Promise<ContextDoc[]> {
    return mine(Object.values(contextDocs.read()), filterUid)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async saveContextDoc(d: ContextDoc): Promise<void> {
    const all = contextDocs.read();
    all[d.id] = d;
    contextDocs.write(all);
  },
  async deleteContextDoc(id: string): Promise<void> {
    const all = contextDocs.read();
    delete all[id];
    contextDocs.write(all);
  },

  async getSetting(key: string): Promise<string | null> {
    return settings.read()[key] ?? null;
  },
  async setSetting(key: string, value: string): Promise<void> {
    const all = settings.read();
    all[key] = value;
    settings.write(all);
  },
};
