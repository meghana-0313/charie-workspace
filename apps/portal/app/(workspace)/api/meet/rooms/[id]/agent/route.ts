// Charie call agent state + consent decisions.
// GET: any call participant (member session or guest invite) sees the same
// thinking stream and action cards. POST: members enable/disable and
// propose; decisions are member-driven, except share-screen which the
// participant being asked may also approve from their own browser.
import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { store } from "@/lib/store";
import { identity } from "@/lib/who";
import { getAgent } from "@/lib/livecall";
import { decideAction, disableAgent, enableAgent, proposeAction, refreshRunState } from "@/lib/call-agent";
import type { AgentAction } from "@/lib/livecall";

async function caller(req: Request, roomId: string): Promise<"member" | "guest" | null> {
  if (await identity(req)) return "member";
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return checkInvite(roomId, token) ? "guest" : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if (!(await caller(req, roomId))) return NextResponse.json({ error: "login or invite required" }, { status: 401 });
  await refreshRunState(roomId).catch(() => {});
  const a = getAgent(roomId);
  return NextResponse.json({ enabled: a.enabled, thoughts: a.thoughts, actions: a.actions });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const who = await caller(req, roomId);
  if (!who) return NextResponse.json({ error: "login or invite required" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as {
    op?: string; actionId?: string; decision?: string; kind?: AgentAction["kind"];
  };
  if (b.op === "enable" || b.op === "disable") {
    if (who !== "member") return NextResponse.json({ error: "host only" }, { status: 403 });
    if (b.op === "enable") {
      await store.updateMeetRoom(roomId, { liveNotes: true });
      enableAgent(roomId, room.title);
    } else {
      disableAgent(roomId);
    }
    const a = getAgent(roomId);
    return NextResponse.json({ enabled: a.enabled, thoughts: a.thoughts, actions: a.actions });
  }
  if (b.op === "propose") {
    if (who !== "member") return NextResponse.json({ error: "host only" }, { status: 403 });
    const kinds = ["investigate", "share-screen", "workorder", "summarize"] as const;
    if (!kinds.includes(b.kind as AgentAction["kind"])) return NextResponse.json({ error: "bad kind" }, { status: 400 });
    const action = proposeAction(roomId, b.kind as AgentAction["kind"]);
    return NextResponse.json(action, { status: 201 });
  }
  if (b.op === "decide") {
    const a = getAgent(roomId);
    const action = a.actions.find((x) => x.id === b.actionId);
    if (!action) return NextResponse.json({ error: "no such action" }, { status: 404 });
    // Share-screen asks a participant to show their own screen: they decide.
    if (who !== "member" && action.kind !== "share-screen") {
      return NextResponse.json({ error: "host decides this one" }, { status: 403 });
    }
    if (b.decision !== "approved" && b.decision !== "denied") {
      return NextResponse.json({ error: "decision required" }, { status: 400 });
    }
    const out = await decideAction(roomId, action.id, b.decision, room);
    return NextResponse.json(out);
  }
  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}
