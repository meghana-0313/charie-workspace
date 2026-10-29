// JSON-file store: the local stand-in for Firestore. Same interface the
// Firebase adapter will implement (see docs/FIRESTORE_SCHEMA.md).
// Data lives in apps/portal/.data (gitignored). Auth is a fixed demo user;
// Firebase Auth plugs in at the end.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Approval, PortalRun, Room, RoomMessage, Ticket } from "./types";

export const DEMO_USER = "demo-owner";

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

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

const now = () => new Date().toISOString();

export const store = {
  // Tickets
  listTickets(): Ticket[] {
    return Object.values(tickets.read()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getTicket(id: string): Ticket | null {
    return tickets.read()[id] ?? null;
  },
  createTicket(input: { subject: string; body: string; goal: string; targetUrl: string; voiceNotePath?: string }): Ticket {
    const all = tickets.read();
    const ticket: Ticket = { ...input, id: uid("tkt"), status: "new", createdAt: now(), updatedAt: now() };
    all[ticket.id] = ticket;
    tickets.write(all);
    // Every ticket gets a room immediately — the room IS the workspace.
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
  setTicketStatus(id: string, status: Ticket["status"]) {
    const all = tickets.read();
    if (all[id]) {
      all[id].status = status;
      all[id].updatedAt = now();
      tickets.write(all);
    }
  },

  // Rooms + messages
  getRoom(id: string): Room | null {
    return rooms.read()[id] ?? null;
  },
  getRoomByTicket(ticketId: string): Room | null {
    return Object.values(rooms.read()).find((r) => r.ticketId === ticketId) ?? null;
  },
  addRunToRoom(roomId: string, runId: string) {
    const r = rooms.read();
    if (r[roomId] && !r[roomId].runIds.includes(runId)) {
      r[roomId].runIds.push(runId);
      rooms.write(r);
    }
  },
  listMessages(roomId: string): RoomMessage[] {
    return messages.read()[roomId] ?? [];
  },
  addMessage(roomId: string, input: { authorType: "human" | "agent"; authorName: string; body: string; findingIds?: string[] }): RoomMessage {
    const all = messages.read();
    const msg: RoomMessage = { ...input, findingIds: input.findingIds ?? [], id: uid("msg"), createdAt: now() };
    all[roomId] = [...(all[roomId] ?? []), msg];
    messages.write(all);
    return msg;
  },

  // Approvals
  listApprovals(roomId: string): Approval[] {
    return approvals.read()[roomId] ?? [];
  },
  addApproval(roomId: string, input: { findingIds: string[]; instruction: string; approvedBy: string }): Approval {
    const all = approvals.read();
    const a: Approval = { ...input, id: uid("appr"), status: "approved", createdAt: now() };
    all[roomId] = [...(all[roomId] ?? []), a];
    approvals.write(all);
    return a;
  },

  // Runs
  getRun(id: string): PortalRun | null {
    return runs.read()[id] ?? null;
  },
  createRun(input: Omit<PortalRun, "status" | "createdAt">): PortalRun {
    const all = runs.read();
    const run: PortalRun = { ...input, status: "running", createdAt: now() };
    all[run.id] = run;
    runs.write(all);
    return run;
  },
  setRunStatus(id: string, status: PortalRun["status"]) {
    const all = runs.read();
    if (all[id]) {
      all[id].status = status;
      runs.write(all);
    }
  },
};
