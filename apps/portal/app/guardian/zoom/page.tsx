import Link from "next/link";
import { zoomStatus } from "@/lib/guardian";
import { SuiteNav } from "@/components/suite-nav";
import { ZoomJoinForm } from "@/components/suite";

export const dynamic = "force-dynamic";

export default async function ZoomPage() {
  const status = await zoomStatus();
  return (
    <>
      <p><Link href="/guardian">← Guardian</Link></p>
      <SuiteNav current="/guardian/zoom" />
      <div className="panel">
        <h2>Zoom auto-join <span className="pill">{status?.configured ? "live via recall.ai" : "not configured"}</span></h2>
        {!status?.configured ? (
          <>
            <p className="muted small">
              Standup and incident calls get a recall.ai bot that records and transcribes; action
              items flow back as Guardian signals. Three steps to light it up:
            </p>
            <ol className="repro">
              {(status?.setup ?? ["Engine unreachable."]).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </>
        ) : (
          <>
            <p className="muted small">Recall.ai connected. Dispatch a bot to any Zoom meeting:</p>
            <ZoomJoinForm />
            <h3 style={{ marginTop: 14 }}>Recent bots ({status.bots.length})</h3>
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
                      <td><span className="pill">{b.status}</span></td>
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
