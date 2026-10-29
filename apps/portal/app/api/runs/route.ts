import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { runStatus, spawnEngineRun } from "@/lib/engine";

export async function POST(req: Request) {
  const { ticketId, roomId, kind, targetUrl, baselineRunId } = (await req.json().catch(() => ({}))) as {
    ticketId?: string; roomId?: string; kind?: string; targetUrl?: string; baselineRunId?: string;
  };
  if (!ticketId || !roomId || (kind !== "investigate" && kind !== "verify") || !targetUrl) {
    return NextResponse.json({ error: "ticketId, roomId, kind=investigate|verify, targetUrl required" }, { status: 400 });
  }
  if (!store.getTicket(ticketId) || !store.getRoom(roomId)) {
    return NextResponse.json({ error: "unknown ticket or room" }, { status: 404 });
  }
  if (kind === "verify" && !baselineRunId) {
    return NextResponse.json({ error: "verify needs baselineRunId" }, { status: 400 });
  }
  const runId = spawnEngineRun({ targetUrl, verify: kind === "verify", baseline: baselineRunId });
  store.createRun({ id: runId, ticketId, roomId, kind, targetUrl, baselineRunId });
  store.addRunToRoom(roomId, runId);
  store.setTicketStatus(ticketId, "investigating");
  store.addMessage(roomId, {
    authorType: "agent",
    authorName: "GhostQA",
    body: kind === "verify" ? `Verification started against baseline ${baselineRunId}.` : "Investigation started — driving the app now.",
  });
  return NextResponse.json({ runId, status: "running" }, { status: 201 });
}

export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  const rec = store.getRun(runId);
  if (!rec) return NextResponse.json({ error: "unknown run" }, { status: 404 });
  const status = runStatus(runId);
  if (rec.status === "running" && status !== "running") {
    store.setRunStatus(runId, status);
    if (status === "done" && rec.kind === "verify") store.setTicketStatus(rec.ticketId, "verified");
    else if (status === "done") store.setTicketStatus(rec.ticketId, "in-room");
  }
  return NextResponse.json({ ...store.getRun(runId), live: status });
}
