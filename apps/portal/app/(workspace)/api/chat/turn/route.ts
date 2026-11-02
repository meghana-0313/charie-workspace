import { NextResponse } from "next/server";
import { store, uid } from "@/lib/store";
import { answerMessage, type LoopTurn } from "@/lib/charie-chat";
import { transcribeNote } from "@/lib/engine";
import { identity, scopeUid } from "@/lib/who";
import type { ChatAttachment } from "@/lib/types";

export const maxDuration = 300;

const KINDS = ["image", "video", "audio", "file"] as const;

/** Only portal-issued blobs may ride along; anything else is dropped. */
function cleanAttachments(raw: unknown): ChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatAttachment[] = [];
  for (const a of raw.slice(0, 6) as Array<Partial<ChatAttachment>>) {
    if (typeof a?.url !== "string" || typeof a?.path !== "string") continue;
    if (!a.url.startsWith("/api/uploads/") || !a.path.startsWith("uploads/") || a.path.includes("..")) continue;
    out.push({
      name: String(a.name ?? "attachment").slice(0, 120),
      url: a.url, path: a.path,
      kind: KINDS.includes(a.kind as ChatAttachment["kind"]) ? (a.kind as ChatAttachment["kind"]) : "file",
    });
  }
  return out;
}

// POST /api/chat/turn {threadId?, text, attachments?} - one message through Charie.
export async function POST(req: Request) {
  const id = await identity(req);
  if (!id) return NextResponse.json({ error: "login required" }, { status: 401 });
  const mine = scopeUid(id);
  const { threadId, text, attachments } = (await req.json().catch(() => ({}))) as {
    threadId?: string; text?: string; attachments?: unknown;
  };
  const clean = String(text ?? "").trim().slice(0, 2000);
  const atts = cleanAttachments(attachments);
  if (!clean && atts.length === 0) return NextResponse.json({ error: "text or attachment required" }, { status: 400 });
  let thread = threadId ? await store.getThread(threadId) : null;
  if (threadId && !thread) return NextResponse.json({ error: "no such thread" }, { status: 404 });
  if (thread && mine && thread.uid && thread.uid !== mine) return NextResponse.json({ error: "not yours" }, { status: 403 });
  if (!thread) {
    const at = new Date().toISOString();
    thread = {
      id: uid("chat"), uid: mine, title: (clean || atts[0]?.name || "Attachment").slice(0, 80),
      messages: [], createdAt: at, updatedAt: at,
    };
  }
  // Attachment manifest for the model: voice notes are transcribed through
  // the same engine path as voice tickets; media is referenced by name + URL.
  const notes: string[] = [];
  for (const a of atts) {
    if (a.kind === "audio") {
      const t = await transcribeNote(a.path).catch(() => null);
      notes.push(t ? `[voice note "${a.name}", transcribed]: ${t.body || t.subject}` : `[voice note attached: ${a.name} (transcription unavailable)]`);
    } else if (a.kind === "image") {
      notes.push(`[screenshot attached: ${a.name} at ${a.url}]`);
    } else if (a.kind === "video") {
      notes.push(`[video attached: ${a.name} at ${a.url}]`);
    } else {
      notes.push(`[file attached: ${a.name} at ${a.url}]`);
    }
  }
  const forModel = [clean, ...notes].filter(Boolean).join("\n");
  const history: LoopTurn[] = [
    ...thread.messages.slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: m.text })),
    { role: "user" as const, content: forModel },
  ];
  const ans = await answerMessage({ history, uid: mine });
  const at = new Date().toISOString();
  thread.messages.push({ role: "user", text: clean, ...(atts.length > 0 ? { attachments: atts } : {}), at });
  thread.messages.push({
    role: "assistant", text: ans.text, model: ans.model, actions: ans.actions, at,
    ...(ans.consent ? { consent: ans.consent } : {}),
  });
  thread.updatedAt = at;
  await store.saveThread(thread);
  return NextResponse.json({
    threadId: thread.id, text: ans.text, model: ans.model, actions: ans.actions,
    ...(ans.consent ? { consent: { id: ans.consent.id, tool: ans.consent.tool, title: ans.consent.title, detail: ans.consent.detail, status: ans.consent.status } } : {}),
  });
}
