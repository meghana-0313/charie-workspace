import Link from "next/link";
import { store } from "@/lib/store";
import { zoomStatus } from "@/lib/guardian";
import { MeetCreateForm } from "@/components/meet";
import { ZoomJoinForm } from "@/components/suite";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MeetPage() {
  const [rooms, status] = await Promise.all([store.listMeetRooms(), zoomStatus()]);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/zoom", "Meet"]]}
        title="Meet"
        sub="Built in video calls for standups and incident war rooms. No third party needed; Zoom fallback stays for external meetings."
      />
      <div className="card">
        <div className="card-title">Charie rooms</div>
        <MeetCreateForm />
        <div className="section-label">Open rooms ({rooms.length})</div>
        {rooms.length === 0 ? (
          <EmptyState title="No rooms yet" body="Start one above, then share its URL with the team." />
        ) : (
          <table>
            <thead><tr><th>Room</th><th>Opened</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/guardian/zoom/rooms/${r.id}`}>{r.title}</Link></td>
                  <td className="small muted">{r.createdAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
            <p className="muted small">For meetings outside Charie, dispatch a recorder bot. Transcripts flow back as signals.</p>
            <ZoomJoinForm />
          </>
        )}
      </div>
    </>
  );
}
