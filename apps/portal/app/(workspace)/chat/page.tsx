import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { ChatPanel, type ChatMsg } from "@/components/chat";
import { PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread: activeId } = await searchParams;
  const myUid = scopeUid(await identity());
  const threads = await store.listThreads(myUid);
  const active = activeId ? threads.find((t) => t.id === activeId) ?? null : null;
  const initial: ChatMsg[] = (active?.messages ?? []).map((m) => ({
    role: m.role, text: m.text, model: m.model, actions: m.actions, attachments: m.attachments, at: m.at,
  }));
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/chat", "Chat"]]}
        title="Chat with Charie"
        sub="Your autonomous teammate on Meta Muse Spark. It checks state, files tickets, and runs scans with tools, and shows receipts for everything."
      />
      <div className="chat-layout">
        <div className="card chat-threads">
          <div className="card-title">Threads</div>
          <p><Link href="/chat" className="secondary sm">+ New chat</Link></p>
          {threads.length === 0 ? (
            <p className="small muted">No chats yet.</p>
          ) : (
            <ul className="thread-list">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link href={`/chat?thread=${t.id}`} className={t.id === active?.id ? "on" : ""}>
                    {t.title || "Untitled"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card chat-main">
          <ChatPanel threadId={active?.id ?? null} initial={initial} />
        </div>
      </div>
    </>
  );
}
