import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { runStatus, spawnEngineRun } from "@/lib/engine";

export async function POST(req: Request) {
  const { ticketId, roomId, kind, targetUrl, goal, baselineRunId } = (await req.json().catch(() => ({}))) as {
    ticketId?: string; roomId?: string; kind?: string; targetUrl?: string; goal?: string; baselineRunId?: string;
  };
  if (!ticketId || !roomId || (kind !== "investigate" && kind !== "verify") || !targetUrl || !goal) {
    return NextResponse.json({ error: "ticketId, roomId, kind=investigate|verify, targetUrl, goal required" }, { status: 400 });
  }
  if (!(await store.getTicket(ticketId)) || !(await store.getRoom(roomId))) {
    return NextResponse.json({ error: "unknown ticket or room" }, { status: 404 });
  }
  if (kind === "verify" && !baselineRunId) {
    return NextResponse.json({ error: "verify needs baselineRunId" }, { status: 400 });
  }
  let runId: string;
  try {
    runId = await spawnEngineRun({ targetUrl, goal, verify: kind === "verify", baseline: baselineRunId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  await store.createRun({ id: runId, ticketId, roomId, kind, targetUrl, baselineRunId });
  await store.addRunToRoom(roomId, runId);
  await store.setTicketStatus(ticketId, "investigating");
  await store.addMessage(roomId, {
    authorType: "agent",
    authorName: "GhostQA",
    body: kind === "verify" ? `Verification started against baseline ${baselineRunId}.` : "Investigation started — driving the app now.",
  });
  return NextResponse.json({ runId, status: "running" }, { status: 201 });
}

export async function GET(req: Request) {
  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  const rec = await store.getRun(runId);
  if (!rec) return NextResponse.json({ error: "unknown run" }, { status: 404 });
  const status = await runStatus(runId);
  if (rec.status === "running" && status !== "running") {
    await store.setRunStatus(runId, status);
    if (status === "done" && rec.kind === "verify") await store.setTicketStatus(rec.ticketId, "verified");
    else if (status === "done") await store.setTicketStatus(rec.ticketId, "in-room");
  }
  return NextResponse.json({ ...(await store.getRun(runId)), live: status });
}
