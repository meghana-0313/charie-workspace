// Firestore store: the production adapter. Same async interface as
// store-file.ts, per docs/FIRESTORE_SCHEMA.md. Auth is ADC (attached service
// account on Cloud Run, `gcloud auth application-default login` locally).
// Timestamps stay ISO strings so domain types are identical across adapters.

import { getFirestore } from "firebase-admin/firestore";
import type { Approval, PortalRun, Room, RoomMessage, Ticket } from "./types";
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

export const firestoreStore = {
  async listTickets(): Promise<Ticket[]> {
    const snap = await firestore().collection("tickets").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as Ticket);
  },
  async getTicket(id: string): Promise<Ticket | null> {
    const d = await firestore().collection("tickets").doc(id).get();
    return d.exists ? (d.data() as Ticket) : null;
  },
  async createTicket(input: { subject: string; body: string; goal: string; targetUrl: string; voiceNotePath?: string }): Promise<Ticket> {
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
  async listRuns(limit = 20): Promise<PortalRun[]> {
    const snap = await firestore().collection("runs").orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map((d) => d.data() as PortalRun);
  },
};
