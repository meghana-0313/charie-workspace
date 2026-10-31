import { zoomStatus } from "@/lib/guardian";
import { ZoomJoinForm } from "@/components/suite";
import { Badge, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ZoomPage() {
  const status = await zoomStatus();
  return (
    <>
      <PageHead
        crumbs={[["/", "Overview"], ["/guardian/zoom", "Meetings"]]}
        title={<>Zoom auto-join <Badge tone={status?.configured ? "minor" : undefined}>{status?.configured ? "live via recall.ai" : "not configured"}</Badge></>}
        sub="Standup and incident calls get a recall.ai bot that records and transcribes; action items flow back as Guardian signals."
      />
      <div className="card">
        {!status?.configured ? (
          <>
            <div className="card-title">Setup</div>
            <ol className="repro">
              {(status?.setup ?? ["Engine unreachable."]).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </>
        ) : (
          <>
            <div className="card-title">Dispatch a bot</div>
            <ZoomJoinForm />
            <div className="section-label">Recent bots ({status.bots.length})</div>
            {status.bots.length === 0 ? (
              <p className="muted small">None yet.</p>
            ) : (
              <table>
                <thead><tr><th>Bot</th><th>Meeting</th><th>Status</th></tr></thead>
                <tbody>
                  {status.bots.map((b) => (
                    <tr key={b.id}>
                      <td className="small"><code>{b.id}</code></td>
                      <td className="small">{b.meetingUrl}</td>
                      <td><Badge>{b.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  );
}
