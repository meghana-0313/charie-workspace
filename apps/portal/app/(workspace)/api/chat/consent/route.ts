import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { executeChatTool } from "@/lib/charie-chat";
import { identity, scopeUid } from "@/lib/who";

// Approve or deny a Charie chat consent card. The proposed tool runs only
// here, only after an explicit Approve from the signed-in user.
export async function POST(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  const mine = scopeUid(id);
  const { threadId, consentId, decision } = (await req.json().catch(() => ({}))) as {
    threadId?: string; consentId?: string; decision?: string;
  };
  if (decision !== "approved" && decision !== "denied") {
    return NextResponse.json({ error: "decision must be approved or denied" }, { status: 400 });
  }
  const thread = threadId ? await store.getThread(threadId) : null;
  if (!thread) return NextResponse.json({ error: "no such thread" }, { status: 404 });
  if (mine && thread.uid && thread.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  const msg = thread.messages.find((m) => m.consent?.id === consentId && m.consent?.status === "pending");
  if (!msg?.consent) return NextResponse.json({ error: "no pending consent card" }, { status: 404 });
  const at = new Date().toISOString();
  if (decision === "denied") {
    msg.consent.status = "denied";
    thread.messages.push({ role: "assistant", text: "Okay, I will not run that. Nothing was changed.", at });
    thread.updatedAt = at;
    await store.saveThread(thread);
    return NextResponse.json({ status: "denied", text: "Okay, I will not run that. Nothing was changed." });
  }
  msg.consent.status = "approved";
  // The args ride on the message only server-side via the thread title-safe
  // detail is not enough to re-run, so args were stashed in the message text
  // metadata at creation time (see turn route): recover them from consent.
  const args = (msg.consent as { args?: Record<string, unknown> }).args ?? {};
  let result: string;
  try {
    result = await executeChatTool(msg.consent.tool, args, mine);
    msg.consent.status = "done";
    msg.consent.result = result.slice(0, 300);
  } catch (e) {
    result = `It failed: ${(e as Error).message.slice(0, 160)}`;
    msg.consent.status = "failed";
    msg.consent.result = result;
  }
  thread.messages.push({ role: "assistant", text: `Done. ${result}`, at });
  thread.updatedAt = at;
  await store.saveThread(thread);
  return NextResponse.json({ status: msg.consent.status, text: `Done. ${result}` });
}
