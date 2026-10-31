import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { store } from "@/lib/store";
import type { MeetSignalKind } from "@/lib/types";

const KINDS: MeetSignalKind[] = ["join", "leave", "offer", "answer", "candidate"];

/** Guests authenticate with ?token=; members ride the session cookie. */
function guestOk(req: Request, roomId: string): boolean {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return false;
  return checkInvite(roomId, token);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  if (!(await store.getMeetRoom(roomId))) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const since = Number(new URL(req.url).searchParams.get("since") ?? "0");
  if (!Number.isFinite(since) || since < 0) return NextResponse.json({ error: "bad since" }, { status: 400 });
  const u = new URL(req.url);
  if (u.searchParams.get("token") && !guestOk(req, roomId)) {
    return NextResponse.json({ error: "bad invite" }, { status: 403 });
  }
  return NextResponse.json({ signals: await store.listMeetSignals(roomId, since) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  if (!(await store.getMeetRoom(roomId))) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const u = new URL(req.url);
  if (u.searchParams.get("token") && !guestOk(req, roomId)) {
    return NextResponse.json({ error: "bad invite" }, { status: 403 });
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
