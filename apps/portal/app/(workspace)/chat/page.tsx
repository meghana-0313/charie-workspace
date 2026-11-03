import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { ChatPanel, type ChatMsg } from "@/components/chat";
import { Badge, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread: activeId } = await searchParams;
  const myUid = scopeUid(await identity());
  const [threads, repos, tickets] = await Promise.all([
    store.listThreads(myUid),
    store.listRepos(myUid),
    store.listTickets(myUid),
  ]);
  const active = activeId ? threads.find((t) => t.id === activeId) ?? null : null;
  const initial: ChatMsg[] = (active?.messages ?? []).map((m) => ({
    role: m.role, text: m.text, model: m.model, actions: m.actions, attachments: m.attachments, consent: m.consent, at: m.at,
  }));
  const openTickets = tickets.filter((t) => t.status !== "closed" && t.status !== "verified");
  const activeTask = openTickets[0];
  const recentAttachments = (active?.messages ?? []).flatMap((m) => m.attachments ?? []).slice(-4);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/chat", "Chat"]]}
        title={<>Chat with Charie <Badge tone="minor">Agent Online</Badge></>}
        sub="Investigate, debug, test and fix with your autonomous engineering partner."
      />
      <div className="chat-layout">
        <div className="card chat-threads">
          <p><Link href="/chat" className="btn" style={{ width: "100%", justifyContent: "center" }}>+ New Chat</Link></p>
          <div className="section-label">Recent Chats</div>
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
          <ChatPanel key={active?.id ?? "new"} threadId={active?.id ?? null} initial={initial} />
        </div>
        <div className="card chat-rail">
          <div className="tabs" style={{ marginBottom: 10 }}><span className="tab on" style={{ padding: "6px 12px" }}>Context</span><span className="small muted" style={{ alignSelf: "center" }}>Tools · Activity</span></div>
          <div className="section-label">Repository</div>
          {repos[0] ? (
            <p className="small"><strong>{repos[0].owner}/{repos[0].repo}</strong><br /><span className="muted">Branch main · Production</span></p>
          ) : (
            <p className="small muted">No repo connected. <Link href="/repos">Connect one</Link>.</p>
          )}
          <div className="section-label">Active Task</div>
          {activeTask ? (
            <p className="small"><Link href={`/tickets/${activeTask.id}`}>{activeTask.subject}</Link><br /><Badge tone={activeTask.status}>{activeTask.status}</Badge></p>
          ) : (
            <p className="small muted">No open tickets. Ask Charie to file one.</p>
          )}
          <div className="section-label">Evidence</div>
          {recentAttachments.length === 0 ? (
            <p className="small muted">Attachments from this chat appear here.</p>
          ) : recentAttachments.map((a) => (
            <p key={a.url} className="small" style={{ margin: "4px 0" }}><a href={a.url} target="_blank" rel="noreferrer">{a.name}</a> <span className="muted">· {a.kind}</span></p>
          ))}
          <div className="section-label">Findings</div>
          <p className="small"><strong>{openTickets.length}</strong> <span className="muted">open ticket(s) Charie can work on.</span></p>
          <p><Link href="/tickets" className="btn secondary sm">Open in Tickets</Link></p>
        </div>
      </div>
    </>
  );
}
