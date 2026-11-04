import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { zoomStatus } from "@/lib/guardian";
import { InviteButton, MeetCreateForm, ReopenButton } from "@/components/meet";
import { meetRoomStatus } from "@/lib/room-status";
import { ZoomJoinForm } from "@/components/suite";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MeetPage() {
  const myUid = scopeUid(await identity());
  const [rooms, status] = await Promise.all([store.listMeetRooms(myUid), zoomStatus(myUid)]);
  const openRooms = rooms.filter((r) => meetRoomStatus(r) === "Open");
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/zoom", "Meet"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="video" size={19} /></span> Meet</>}
        sub="Built in video calls for your team AND the people outside it: send one guest link and a customer joins this same room, no account needed. Charie joins the call itself - she listens, answers out loud, looks at a shared screen when you let her, takes notes, and proposes investigations with your consent."
      />
      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="video" size={20} /></span><div><div className="stat-num">{openRooms.length}</div><div className="stat-label">Open rooms</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="brain" size={20} /></span><div><div className="stat-num">Charie</div><div className="stat-label">AI agent in every room</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="lock" size={20} /></span><div><div className="stat-num">Private</div><div className="stat-label">Peer to peer, no recording</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="phone" size={20} /></span><div><div className="stat-num">{status?.configured ? "Ready" : "Off"}</div><div className="stat-label">Zoom fallback</div></div></div></div>
      </div>
      <div className="card">
        <div className="card-title">Charie rooms</div>
        <MeetCreateForm />
        <div className="section-label">Rooms ({rooms.length})</div>
        {rooms.length === 0 ? (
          <EmptyState title="No rooms yet" body="Start one above, then share its URL with the team." />
        ) : (
          <table>
            <thead><tr><th>Room</th><th>Status</th><th>Opened</th><th>Context</th><th></th></tr></thead>
            <tbody>
              {rooms.map((r) => {
                const st = meetRoomStatus(r);
                return (
                  <tr key={r.id}>
                    <td><Link href={`/guardian/zoom/rooms/${r.id}`}>{r.title}</Link></td>
                    <td><Badge tone={st === "Open" ? "done" : undefined}>{st}</Badge></td>
                    <td className="small muted">{r.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td className="small muted">{r.transcript?.length ? `${r.transcript.length} transcript lines saved` : "No saved transcript"}</td>
                    <td>{st === "Open" ? <InviteButton roomId={r.id} /> : <ReopenButton roomId={r.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <div className="card-title">Privacy</div>
        <p className="muted small">Calls are private by default: media flows peer to peer, and the portal only relays connection setup. Nothing is recorded. External guests join from one invite link with just a name and their issue - no Charie account. Live notes and transcription are optional, stay off unless someone in the call turns them on, and guests are told before they join. Guest links expire after 24 hours and open just one room.</p>
      </div>
      <div className="card">
        <div className="card-title">
          External Zoom calls <Badge tone={status?.configured ? "minor" : undefined}>{status?.configured ? "bot ready" : "not configured"}</Badge>
        </div>
        {!status?.configured ? (
          <ol className="repro">
            {(status?.setup ?? ["Engine unreachable."]).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        ) : (
          <>
            <p className="muted small">Guests can join Charie rooms directly from an invite link - use this only if a meeting already lives in Zoom. Dispatch a recorder bot and transcripts flow back as signals.</p>
            <ZoomJoinForm />
          </>
        )}
      </div>
    </>
  );
}
