import Link from "next/link";
import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { BuildButton, BuildPoller, DisconnectButton } from "@/components/repo-forms";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RepoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await store.getRepo(id);
  if (!repo) notFound();
  const builds = await store.listBuilds(id);
  const latest = builds[0];

  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/repos", "Test a repo"], [`/repos/${repo.id}`, `${repo.owner}/${repo.repo}`]]}
        title={<>{repo.owner}/{repo.repo} <Badge tone={repo.status === "live" ? "minor" : repo.status === "failed" ? "failed" : undefined}>{repo.status}</Badge></>}
        sub={<>Branch <code>{repo.branch}</code>{repo.subdir ? <> · subdir <code>{repo.subdir}</code></> : null} · {repo.visibility}{repo.hasToken ? " · token set" : ""}{repo.lastSha ? <> · <code>{repo.lastSha.slice(0, 7)}</code></> : null}</>}
        actions={<><BuildButton repoId={repo.id} building={repo.status === "building"} /><DisconnectButton repoId={repo.id} /></>}
      />

      {repo.appUrl && (
        <div className="card">
          <div className="card-title">Deployed app</div>
          <p><a href={repo.appUrl} target="_blank" rel="noreferrer">{repo.appUrl}</a></p>
          {repo.ticketId && <p className="small"><Link href={`/tickets/${repo.ticketId}`}>Open the investigation ticket →</Link></p>}
        </div>
      )}

      <div className="card">
        <div className="card-title">Builds ({builds.length})</div>
        {builds.length === 0 ? (
          <EmptyState title="No builds yet" body="Press Build + test now to compile, deploy, and investigate this repo." />
        ) : (
          <table>
            <thead><tr><th>Build</th><th>Commit</th><th>Strategy</th><th>Status</th><th>Ticket</th><th>Started</th></tr></thead>
            <tbody>
              {builds.map((b) => (
                <tr key={b.id}>
                  <td className="small"><code>{b.id}</code></td>
                  <td className="small"><code>{b.sha.slice(0, 7)}</code></td>
                  <td><Badge>{b.strategy}</Badge></td>
                  <td><BuildPoller buildId={b.id} status={b.status} /></td>
                  <td className="small">{b.ticketId ? <Link href={`/tickets/${b.ticketId}`}>ticket</Link> : <span className="muted">-</span>}</td>
                  <td className="small muted">{b.createdAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {latest && !["deployed", "failure", "error"].includes(latest.status) && (
          <p className="small muted" style={{ marginTop: 8 }}>Latest build is still running. This page refreshes itself on completion.</p>
        )}
      </div>
    </>
  );
}
