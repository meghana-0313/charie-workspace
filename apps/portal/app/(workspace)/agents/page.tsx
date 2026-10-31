import Link from "next/link";
import { store } from "@/lib/store";
import { readFindings } from "@/lib/engine";
import { identity, scopeUid } from "@/lib/who";
import { CopyButton } from "@/components/agents";
import { EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

const MCP_CONFIG = `{
  "mcpServers": {
    "charie": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/charie-workspace/services/mcp-server"
    }
  }
}`;

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

export default async function AgentsPage() {
  const runs = await store.listRuns(10, scopeUid(await identity()));
  const cards = await Promise.all(
    runs.map(async (r) => {
      const findings = (await readFindings(r.id).catch(() => null)) ?? [];
      return {
        run: r,
        count: findings.length,
        prompt: findings.length
          ? runPrompt({
              ticketId: r.ticketId,
              runId: r.id,
              items: findings.map((f) => `${f.id}: ${f.title} [${f.severity}]`),
            })
          : "",
      };
    }),
  );
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/agents", "Coding agents"]]}
        title="Coding agents"
        sub="Hand findings to your AI coding agent with full evidence, then verify the fix back here. Nothing to install in the cloud."
      />
      <div className="grid2">
        <div className="card">
          <div className="card-title">The loop in 3 steps</div>
          <ol className="onboard">
            <li><span className="step">1</span><span><strong>Investigate.</strong> File a ticket or connect a repo; Charie drives the app and files findings with repro steps.</span></li>
            <li><span className="step">2</span><span><strong>Dispatch.</strong> Approve findings on the ticket page and press dispatch, or copy a run prompt below into your agent.</span></li>
            <li><span className="step">3</span><span><strong>Verify.</strong> Paste the fix back (or push the branch) and press Verify fix; Charie diffs before/after.</span></li>
          </ol>
        </div>
        <div className="card">
          <div className="card-title">MCP server (local runs)</div>
          <p className="small muted">
            Point your agent at the repo checkout. Tools: <code>list_runs</code>,{" "}
            <code>list_findings</code>, <code>get_finding</code> (repro + fix packet),{" "}
            <code>get_verification</code>.
          </p>
          <pre className="small" style={{ overflowX: "auto" }}>{MCP_CONFIG}</pre>
          <CopyButton text={MCP_CONFIG} label="Copy MCP config" />
        </div>
      </div>
      <div className="card">
        <div className="card-title">Recent runs ({cards.length})</div>
        {cards.length === 0 ? (
          <EmptyState title="No runs yet" body="File a ticket from Home and the investigation starts by itself." />
        ) : (
          <table>
            <thead><tr><th>Run</th><th>Ticket</th><th>Findings</th><th></th></tr></thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.run.id}>
                  <td className="small"><code>{c.run.id.slice(0, 18)}</code><br /><span className="muted">{c.run.kind} · {c.run.status}</span></td>
                  <td><Link href={`/tickets/${c.run.ticketId}`}>open</Link></td>
                  <td>{c.count}</td>
                  <td>{c.prompt ? <CopyButton text={c.prompt} label="Copy agent prompt" /> : <span className="small muted">no findings</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
