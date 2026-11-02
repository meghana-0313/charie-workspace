import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { identity } from "@/lib/who";
import { store } from "@/lib/store";
import type { MeetRoom, MeetSignalKind } from "@/lib/types";

const KINDS: MeetSignalKind[] = ["join", "leave", "offer", "answer", "candidate"];

/** Guests authenticate with ?token=; members ride the session cookie. */
function guestOk(req: Request, roomId: string): boolean {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return false;
  return checkInvite(roomId, token);
}

/** Token guests must hold a valid invite AND a completed consent check-in. */
async function guestAllowed(req: Request, roomId: string): Promise<boolean> {
  if (!new URL(req.url).searchParams.get("token")) return true;
  return guestOk(req, roomId) && (await store.hasMeetCheckin(roomId));
}

/** Member callers (session cookie) must own the room; legacy rooms without an owner stay open. */
async function memberOk(req: Request, room: MeetRoom): Promise<boolean> {
  if (!room.uid) return true;
  const me = await identity(req);
  return Boolean(me?.uid) && me!.uid === room.uid;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if (!new URL(req.url).searchParams.get("token") && !(await memberOk(req, room))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const since = Number(new URL(req.url).searchParams.get("since") ?? "0");
  if (!Number.isFinite(since) || since < 0) return NextResponse.json({ error: "bad since" }, { status: 400 });
  if (!(await guestAllowed(req, roomId))) {
    return NextResponse.json({ error: "check in with consent first" }, { status: 403 });
  }
  return NextResponse.json({ signals: await store.listMeetSignals(roomId, since) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if (!new URL(req.url).searchParams.get("token") && !(await memberOk(req, room))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await guestAllowed(req, roomId))) {
    return NextResponse.json({ error: "check in with consent first" }, { status: 403 });
  }
  const b = (await req.json().catch(() => ({}))) as { from?: string; to?: string; kind?: string; payload?: string };
  if (!b.from?.trim() || !b.to?.trim() || !KINDS.includes(b.kind as MeetSignalKind)) {
    return NextResponse.json({ error: "from, to, kind join|leave|offer|answer|candidate required" }, { status: 400 });
  }
  const payload = String(b.payload ?? "");
  if (payload.length > 20000) return NextResponse.json({ error: "payload too large" }, { status: 400 });
  try {
    const sig = await store.postMeetSignal(roomId, {
      from: b.from.trim().slice(0, 64), to: b.to.trim().slice(0, 64),
      kind: b.kind as MeetSignalKind, payload,
    });
    return NextResponse.json(sig, { status: 201 });
  } catch {
    return NextResponse.json({ error: "no such room" }, { status: 404 });
  }
}
