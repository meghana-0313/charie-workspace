import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { answerMessage, type LoopTurn } from "@/lib/charie-chat";
import { identity, scopeUid } from "@/lib/who";

export const maxDuration = 300;

// POST /api/chat/turn {threadId?, text} - one user message through Charie.
export async function POST(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  const mine = scopeUid(id);
  const { threadId, text } = (await req.json().catch(() => ({}))) as { threadId?: string; text?: string };
  const clean = String(text ?? "").trim().slice(0, 2000);
  if (!clean) return NextResponse.json({ error: "text required" }, { status: 400 });
  let thread = threadId ? await store.getThread(threadId) : null;
  if (threadId && !thread) return NextResponse.json({ error: "no such thread" }, { status: 404 });
  if (thread && mine && thread.uid && thread.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  if (!thread) {
    const at = new Date().toISOString();
    thread = {
      id: uid("chat"), uid: mine, title: clean.slice(0, 80),
      messages: [], createdAt: at, updatedAt: at,
    };
  }
  const history: LoopTurn[] = [
    ...thread.messages.slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: m.text })),
    { role: "user" as const, content: clean },
  ];
  const ans = await answerMessage({ history, uid: mine });
  const at = new Date().toISOString();
  thread.messages.push({ role: "user", text: clean, at });
  thread.messages.push({ role: "assistant", text: ans.text, model: ans.model, actions: ans.actions, at });
  thread.updatedAt = at;
  await store.saveThread(thread);
  return NextResponse.json({ threadId: thread.id, text: ans.text, model: ans.model, actions: ans.actions });
}
