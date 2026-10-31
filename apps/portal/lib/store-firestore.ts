// Firestore store: the production adapter. Same async interface as
// store-file.ts, per docs/FIRESTORE_SCHEMA.md. Auth is ADC (attached service
// account on Cloud Run, `gcloud auth application-default login` locally).
// Timestamps stay ISO strings so domain types are identical across adapters.

import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import type { ApiKey, Approval, GithubToken, GuardEventView, Incident, MeetRoom, MeetSignal, PortalRun, PushSubscription, RepoBuild, RepoConnection, Room, RoomMessage, Schedule, TeamSeat, Ticket } from "./types";
import { adminApp } from "./firebase";
import { uid } from "./uid";

let db: ReturnType<typeof getFirestore> | null = null;

function firestore() {
  if (!db) db = getFirestore(adminApp());
  return db;
}

const now = () => new Date().toISOString();

/** Firestore rejects `undefined` values - drop them (keeps optional fields safe). */
function clean<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** Push endpoints are URLs - hash them into safe doc ids. */
function subId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

/** Per-account visibility: no uid filter sees everything; legacy records
 *  without uid stay visible to their whole team. In-memory filter: no
 *  composite indexes needed. */
function mine<T extends { uid?: string }>(rows: T[], filterUid?: string): T[] {
  if (!filterUid) return rows;
  return rows.filter((r) => !r.uid || r.uid === filterUid);
}

export const firestoreStore = {
  async listTickets(filterUid?: string): Promise<Ticket[]> {
    const snap = await firestore().collection("tickets").orderBy("createdAt", "desc").get();
    return mine(snap.docs.map((d) => d.data() as Ticket), filterUid);
  },
  async getTicket(id: string): Promise<Ticket | null> {
    const d = await firestore().collection("tickets").doc(id).get();
    return d.exists ? (d.data() as Ticket) : null;
  },
  async createTicket(input: { subject: string; body: string; goal: string; targetUrl: string; voiceNotePath?: string; sourceRepo?: string; uid?: string }): Promise<Ticket> {
    const fs = firestore();
    const ticket: Ticket = { ...input, id: uid("tkt"), status: "new", createdAt: now(), updatedAt: now() };
    const room: Room = {
      id: uid("room"), ticketId: ticket.id, title: ticket.subject,
      status: "open", runIds: [], createdAt: now(),
    };
    ticket.roomId = room.id;
    ticket.status = "in-room";
    ticket.updatedAt = now();
    await fs.collection("tickets").doc(ticket.id).set(clean({ ...ticket }));
    await fs.collection("rooms").doc(room.id).set(room);
    return ticket;
  },
  async setTicketStatus(id: string, status: Ticket["status"]): Promise<void> {
    await firestore().collection("tickets").doc(id).update({ status, updatedAt: now() });
  },

  async getRoom(id: string): Promise<Room | null> {
    const d = await firestore().collection("rooms").doc(id).get();
    return d.exists ? (d.data() as Room) : null;
  },
  async getRoomByTicket(ticketId: string): Promise<Room | null> {
    const snap = await firestore().collection("rooms").where("ticketId", "==", ticketId).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as Room);
  },
  async addRunToRoom(roomId: string, runId: string): Promise<void> {
    const ref = firestore().collection("rooms").doc(roomId);
    const d = await ref.get();
    if (!d.exists) return;
    const runIds = (d.data() as Room).runIds;
    if (!runIds.includes(runId)) await ref.update({ runIds: [...runIds, runId] });
  },
  async listMessages(roomId: string): Promise<RoomMessage[]> {
    const snap = await firestore().collection("rooms").doc(roomId).collection("messages").orderBy("createdAt").get();
    return snap.docs.map((d) => d.data() as RoomMessage);
  },
  async addMessage(roomId: string, input: { authorType: "human" | "agent"; authorName: string; body: string; findingIds?: string[] }): Promise<RoomMessage> {
    const msg: RoomMessage = { ...input, findingIds: input.findingIds ?? [], id: uid("msg"), createdAt: now() };
    await firestore().collection("rooms").doc(roomId).collection("messages").doc(msg.id).set(msg);
    return msg;
  },

  async listApprovals(roomId: string): Promise<Approval[]> {
    const snap = await firestore().collection("rooms").doc(roomId).collection("approvals").orderBy("createdAt").get();
    return snap.docs.map((d) => d.data() as Approval);
  },
  async addApproval(roomId: string, input: { findingIds: string[]; instruction: string; approvedBy: string }): Promise<Approval> {
    const a: Approval = { ...input, id: uid("appr"), status: "approved", createdAt: now() };
    await firestore().collection("rooms").doc(roomId).collection("approvals").doc(a.id).set(a);
    return a;
  },
  async setApprovalStatus(roomId: string, approvalId: string, status: Approval["status"]): Promise<Approval | null> {
    const ref = firestore().collection("rooms").doc(roomId).collection("approvals").doc(approvalId);
    const d = await ref.get();
    if (!d.exists) return null;
    await ref.update({ status });
    return { ...(d.data() as Approval), status };
  },

  async getRun(id: string): Promise<PortalRun | null> {
    const d = await firestore().collection("runs").doc(id).get();
    return d.exists ? (d.data() as PortalRun) : null;
  },
  async createRun(input: Omit<PortalRun, "status" | "createdAt">): Promise<PortalRun> {
    const run: PortalRun = { ...input, status: "running", createdAt: now() };
    await firestore().collection("runs").doc(run.id).set(clean({ ...run }));
    return run;
  },
  async setRunStatus(id: string, status: PortalRun["status"]): Promise<void> {
    await firestore().collection("runs").doc(id).update({ status });
  },
  async listRuns(limit = 20, filterUid?: string): Promise<PortalRun[]> {
    const snap = await firestore().collection("runs").orderBy("createdAt", "desc").limit(limit).get();
    return mine(snap.docs.map((d) => d.data() as PortalRun), filterUid);
  },

  async saveEvents(events: GuardEventView[]): Promise<void> {
    const fs = firestore();
    const batch = fs.batch();
    for (const e of events) batch.set(fs.collection("guardian-events").doc(e.id), e);
    await batch.commit();
  },
  async listRecentEvents(limit = 200): Promise<GuardEventView[]> {
    const snap = await firestore().collection("guardian-events").orderBy("ts", "desc").limit(limit).get();
    return snap.docs.map((d) => d.data() as GuardEventView).reverse();
  },
  async saveIncident(inc: Incident): Promise<void> {
    await firestore().collection("incidents").doc(inc.id).set(inc);
  },
  async getIncident(id: string): Promise<Incident | null> {
    const d = await firestore().collection("incidents").doc(id).get();
    return d.exists ? (d.data() as Incident) : null;
  },
  async listIncidents(): Promise<Incident[]> {
    const snap = await firestore().collection("incidents").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as Incident);
  },
  async updateIncident(id: string, patch: Partial<Incident>): Promise<void> {
    await firestore().collection("incidents").doc(id).update({ ...patch, updatedAt: now() });
  },

  async savePushSubscription(sub: Omit<PushSubscription, "createdAt">): Promise<void> {
    await firestore().collection("push_subscriptions").doc(subId(sub.endpoint)).set({ ...sub, createdAt: now() });
  },
  async listPushSubscriptions(): Promise<PushSubscription[]> {
    const snap = await firestore().collection("push_subscriptions").get();
    return snap.docs.map((d) => d.data() as PushSubscription);
  },
  async deletePushSubscription(endpoint: string): Promise<void> {
    await firestore().collection("push_subscriptions").doc(subId(endpoint)).delete().catch(() => {});
  },

  async listRepos(filterUid?: string): Promise<RepoConnection[]> {
    const snap = await firestore().collection("repos").orderBy("createdAt", "desc").get();
    return mine(snap.docs.map((d) => d.data() as RepoConnection), filterUid);
  },
  async getRepo(id: string): Promise<RepoConnection | null> {
    const d = await firestore().collection("repos").doc(id).get();
    return d.exists ? (d.data() as RepoConnection) : null;
  },
  async saveRepo(repo: RepoConnection): Promise<void> {
    await firestore().collection("repos").doc(repo.id).set(clean({ ...repo }));
  },
  async updateRepo(id: string, patch: Partial<RepoConnection>): Promise<void> {
    await firestore().collection("repos").doc(id).update(clean({ ...patch, updatedAt: now() }));
  },
  async deleteRepo(id: string): Promise<void> {
    await firestore().collection("repos").doc(id).delete().catch(() => {});
  },

  async listBuilds(repoId: string): Promise<RepoBuild[]> {
    // No orderBy: where+orderBy needs a composite index. Sort in memory.
    const snap = await firestore().collection("builds").where("repoId", "==", repoId).get();
    return snap.docs
      .map((d) => d.data() as RepoBuild)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getBuild(id: string): Promise<RepoBuild | null> {
    const d = await firestore().collection("builds").doc(id).get();
    return d.exists ? (d.data() as RepoBuild) : null;
  },
  async saveBuild(build: RepoBuild): Promise<void> {
    await firestore().collection("builds").doc(build.id).set(clean({ ...build }));
  },
  async updateBuild(id: string, patch: Partial<RepoBuild>): Promise<void> {
    await firestore().collection("builds").doc(id).update(clean({ ...patch, updatedAt: now() }));
  },

  async listMeetRooms(filterUid?: string): Promise<MeetRoom[]> {
    const snap = await firestore().collection("meet_rooms").orderBy("createdAt", "desc").get();
    return mine(snap.docs.map((d) => d.data() as MeetRoom), filterUid);
  },
  async getMeetRoom(id: string): Promise<MeetRoom | null> {
    const d = await firestore().collection("meet_rooms").doc(id).get();
    return d.exists ? (d.data() as MeetRoom) : null;
  },
  async createMeetRoom(input: { title: string; createdBy: string; uid?: string }): Promise<MeetRoom> {
    const room: MeetRoom = { ...input, id: uid("meet"), seq: 0, createdAt: now(), updatedAt: now() };
    await firestore().collection("meet_rooms").doc(room.id).set(clean({ ...room }));
    return room;
  },
  async postMeetSignal(roomId: string, input: { from: string; to: string; kind: MeetSignal["kind"]; payload: string }): Promise<MeetSignal> {
    const ref = firestore().collection("meet_rooms").doc(roomId);
    const sig = await firestore().runTransaction(async (tx) => {
      const d = await tx.get(ref);
      if (!d.exists) throw new Error("unknown room");
      const seq = (d.data() as MeetRoom).seq + 1;
      tx.update(ref, { seq, updatedAt: now() });
      const s: MeetSignal = { ...input, seq, roomId, createdAt: now() };
      tx.set(ref.collection("signals").doc(String(seq).padStart(10, "0")), s);
      return s;
    });
    // Prune old signals (best effort, outside the transaction).
    const old = await ref.collection("signals").orderBy("seq", "desc").offset(200).get().catch(() => null);
    if (old && !old.empty) {
      const batch = firestore().batch();
      for (const doc of old.docs) batch.delete(doc.ref);
      await batch.commit().catch(() => {});
    }
    return sig;
  },
  async listMeetSignals(roomId: string, since: number): Promise<MeetSignal[]> {
    const snap = await firestore().collection("meet_rooms").doc(roomId).collection("signals")
      .where("seq", ">", since).orderBy("seq").limit(200).get();
    return snap.docs.map((d) => d.data() as MeetSignal);
  },

  async listSeats(): Promise<TeamSeat[]> {
    const snap = await firestore().collection("team_seats").orderBy("createdAt").get();
    return snap.docs.map((d) => d.data() as TeamSeat);
  },
  async getSeatByEmail(email: string): Promise<TeamSeat | null> {
    const snap = await firestore().collection("team_seats").where("emailLower", "==", email.toLowerCase()).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as TeamSeat);
  },
  async saveSeat(seat: TeamSeat): Promise<void> {
    await firestore().collection("team_seats").doc(seat.id).set({ ...seat, emailLower: seat.email.toLowerCase() });
  },
  async deleteSeat(id: string): Promise<void> {
    await firestore().collection("team_seats").doc(id).delete().catch(() => {});
  },
  async linkSeatLogin(id: string, link: { uid: string; name: string }): Promise<void> {
    await firestore().collection("team_seats").doc(id).update({ uid: link.uid, name: link.name, lastLoginAt: now() }).catch(() => {});
  },

  async listApiKeys(filterUid?: string): Promise<ApiKey[]> {
    const snap = await firestore().collection("api_keys").orderBy("createdAt", "desc").get();
    return mine(snap.docs.map((d) => d.data() as ApiKey), filterUid);
  },
  async getApiKeyByPrefix(prefix: string): Promise<ApiKey | null> {
    const snap = await firestore().collection("api_keys").where("prefix", "==", prefix).limit(1).get();
    if (snap.empty) return null;
    const k = snap.docs[0].data() as ApiKey;
    return k.revoked ? null : k;
  },
  async saveApiKey(key: ApiKey): Promise<void> {
    await firestore().collection("api_keys").doc(key.id).set(key);
  },
  async touchApiKey(id: string): Promise<void> {
    await firestore().collection("api_keys").doc(id).update({ lastUsedAt: now() }).catch(() => {});
  },

  async listSchedules(filterUid?: string): Promise<Schedule[]> {
    const snap = await firestore().collection("schedules").orderBy("createdAt").get();
    return mine(snap.docs.map((d) => d.data() as Schedule), filterUid);
  },
  async getSchedule(id: string): Promise<Schedule | null> {
    const d = await firestore().collection("schedules").doc(id).get();
    return d.exists ? (d.data() as Schedule) : null;
  },
  async saveSchedule(s: Schedule): Promise<void> {
    await firestore().collection("schedules").doc(s.id).set(clean({ ...s }));
  },
  async deleteSchedule(id: string): Promise<void> {
    await firestore().collection("schedules").doc(id).delete().catch(() => {});
  },

  async getGithubToken(filterUid: string): Promise<GithubToken | null> {
    const d = await firestore().collection("github_tokens").doc(filterUid).get();
    return d.exists ? (d.data() as GithubToken) : null;
  },
  async saveGithubToken(t: GithubToken): Promise<void> {
    await firestore().collection("github_tokens").doc(t.uid).set(t);
  },
  async deleteGithubToken(filterUid: string): Promise<void> {
    await firestore().collection("github_tokens").doc(filterUid).delete().catch(() => {});
  },

  async getSetting(key: string): Promise<string | null> {
    const d = await firestore().collection("settings").doc(key).get();
    return d.exists ? String((d.data() as { value: string }).value) : null;
  },
  async setSetting(key: string, value: string): Promise<void> {
    await firestore().collection("settings").doc(key).set({ value, updatedAt: now() });
  },
};
