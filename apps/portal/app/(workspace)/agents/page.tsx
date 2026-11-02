import Link from "next/link";
import { headers } from "next/headers";
import { store } from "@/lib/store";
import { readFindings } from "@/lib/engine";
import { identity, scopeUid } from "@/lib/who";
import { CopyButton } from "@/components/agents";
import { DateRangePicker } from "@/components/date-range";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

function runPrompt(opts: { ticketId: string; runId: string; items: string[] }): string {
  return [
    "You are fixing issues found by Charie (autonomous QA).",
    `Ticket room: ${opts.ticketId}`,
    `Run: ${opts.runId}`,
    "",
    "Findings in this run:",
    ...opts.items.map((t) => `- ${t}`),
    "",
    "For each finding: reproduce it, fix it, keep behavior otherwise identical.",
    "Reply with the files changed and how to verify. The team presses Verify fix in Charie.",
  ].join("\n");
}

function when(iso: string): string {
  return iso.slice(5, 16).replace("T", " ");
}

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const myUid = scopeUid(await identity());
  const sp = await searchParams;
  const fromDay = sp.from ?? new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const toDay = sp.to ?? new Date().toISOString().slice(0, 10);
  const runs = (await store.listRuns(50, myUid)).filter((r) => {
    const day = r.createdAt.slice(0, 10);
    return day >= fromDay && day <= toDay;
  });
  const cards = await Promise.all(
    runs.map(async (r) => {
      const findings = (await readFindings(r.id).catch(() => null)) ?? [];
      return {
        run: r,
        count: findings.length,
        prompt: findings.length
          ? runPrompt({ ticketId: r.ticketId, runId: r.id, items: findings.map((f) => `${f.id}: ${f.title} [${f.severity}]`) })
          : "",
      };
    }),
  );
  const h = await headers();
  const host = h.get("host") ?? "localhost:3102";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const cloudConfig = JSON.stringify({
    mcpServers: { charie: { url: `${proto}://${host}/api/mcp`, headers: { Authorization: "Bearer <YOUR_CHARIE_API_KEY>" } } },
  }, null, 2);
  const selected = cards[0];

  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/agents", "Coding Agents"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="code" size={19} /></span> Coding Agents</>}
        sub="Run autonomous coding agents to investigate, fix, test, and ship changes."
        actions={<Link href="/tickets?new=1" className="btn">+ New Run</Link>}
      />
      <div className="tabs">
        <span className="tab on" style={{ padding: "7px 16px" }}>Runs</span>
        <Link href="/tickets">Queue</Link>
        <Link href="/marketplace">Agents</Link>
        <Link href="/settings">Config</Link>
        <Link href="/guardian/night">Logs</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 370px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>All Runs ({cards.length})</strong>
            <DateRangePicker />
          </div>
          {cards.length === 0 ? (
            <EmptyState title="No runs yet" body="File a ticket and the investigation starts by itself." />
          ) : (
            <table>
              <thead><tr><th>Task</th><th>Agent</th><th>Progress</th><th>Status</th><th>Started</th><th></th></tr></thead>
              <tbody>
                {cards.map((c, i) => (
                  <tr key={c.run.id} style={i === 0 ? { background: "var(--accent-dim)" } : undefined}>
                    <td><Link href={`/tickets/${c.run.ticketId}`}><strong>{c.run.kind === "verify" ? "Verify fix" : "Investigate"} · {c.run.id.slice(0, 14)}</strong></Link><br /><span className="small muted">{c.count} finding(s) · {c.run.targetUrl.replace(/^https?:\/\//, "").slice(0, 30)}</span></td>
                    <td><span className="row" style={{ flexWrap: "nowrap" }}><span className="initials">C</span><span className="small">charie-code</span></span></td>
                    <td><span className="row" style={{ flexWrap: "nowrap" }}><span className="progress"><i style={{ width: c.run.status === "done" ? "100%" : c.run.status === "failed" ? "38%" : "64%" }} /></span><span className="small">{c.run.status === "done" ? "100%" : c.run.status === "failed" ? "38%" : "64%"}</span></span></td>
                    <td><Badge tone={c.run.status}>{c.run.status}</Badge></td>
                    <td className="small muted">{when(c.run.createdAt)}</td>
                    <td>{c.prompt ? <CopyButton text={c.prompt} label="Copy prompt" /> : <span className="small muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="section-label">Dispatch over MCP (cloud, no clone needed)</div>
          <pre className="small" style={{ overflowX: "auto" }}>{cloudConfig}</pre>
          <CopyButton text={cloudConfig} label="Copy MCP config" />
        </div>

        <div className="card">
          {selected ? (
            <>
              <div className="row"><span className="initials" style={{ width: 38, height: 38 }}>C</span><div><strong>{selected.run.kind === "verify" ? "Verify fix" : "Investigate"} · {selected.run.id.slice(0, 14)}</strong><br /><span className="small muted">{selected.run.ticketId} · {selected.run.status}</span></div></div>
              <div className="tabs" style={{ marginTop: 12 }}><span className="tab on" style={{ padding: "6px 12px" }}>Details</span><span className="small muted" style={{ alignSelf: "center" }}>Tests · Logs · Changes · Activity</span></div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <p style={{ color: "var(--ok)", margin: "4px 0" }}><strong>{selected.run.status === "done" ? "Completed" : selected.run.status}</strong></p>
                  <p className="small muted">Charie analyzed the issue, collected evidence, and prepared the handoff.</p>
                </div>
                <span className="donut" style={{ background: `conic-gradient(var(--accent) ${selected.run.status === "done" ? 100 : 64}%, var(--surface-overlay) 0)` }}>
                  <span style={{ background: "var(--surface)", borderRadius: "50%", width: 62, height: 62, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{selected.run.status === "done" ? "100%" : "64%"}</span>
                </span>
              </div>
              <table>
                <tbody>
                  <tr><td className="small muted">Agent</td><td className="small">charie-code</td></tr>
                  <tr><td className="small muted">Findings</td><td className="small">{selected.count}</td></tr>
                  <tr><td className="small muted">Target</td><td className="small">{selected.run.targetUrl.replace(/^https?:\/\//, "").slice(0, 34)}</td></tr>
                  <tr><td className="small muted">Started</td><td className="small">{when(selected.run.createdAt)}</td></tr>
                </tbody>
              </table>
              <div className="section-label">Current step</div>
              <p className="small">{selected.run.status === "done" ? "Findings ready for your coding agent." : "Running investigation…"}</p>
              <div className="progress" style={{ marginBottom: 12 }}><i style={{ width: selected.run.status === "done" ? "100%" : "64%" }} /></div>
              <div className="row">
                <Link href={`/tickets/${selected.run.ticketId}`} className="btn sm">Live Logs</Link>
                {selected.prompt && <CopyButton text={selected.prompt} label="View Changes" />}
              </div>
            </>
          ) : (
            <EmptyState title="No run selected" body="Runs appear here after the first investigation." />
          )}
        </div>
      </div>
    </>
  );
}
