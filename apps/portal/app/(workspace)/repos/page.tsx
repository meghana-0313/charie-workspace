import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { ConnectForm, GithubConnect } from "@/components/repo-forms";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReposPage() {
  const myUid = scopeUid(await identity());
  const repos = await store.listRepos(myUid);
  const buildsReady = Boolean(process.env.GCP_PROJECT_ID && process.env.GCS_BUCKET);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/repos", "Test a repo"]]}
        title="Test a repo"
        sub="Connect a GitHub repo and Charie builds it, deploys it, files a ticket, and runs the full investigation. No SDK upload, no external CI."
      />
      <div className="grid2">
        <div className="card">
          <div className="card-title">Connect</div>
          {!buildsReady && (
            <p className="small" style={{ color: "var(--warn)" }}>
              Builds need GCP_PROJECT_ID + GCS_BUCKET on the portal. Connecting works anywhere; building needs prod (or ADC locally).
            </p>
          )}
          <GithubConnect />
          <div className="section-label">Or paste a URL</div>
          <ConnectForm />
          <p className="small muted" style={{ marginTop: 10 }}>
            Connect with GitHub above for one-click access, or paste a URL: public repos need no token, private repos need a PAT.
            Strategy: repo Dockerfile wins, else a generated Node or Python image. Apps must honor $PORT.
          </p>
        </div>
        <div className="card">
          <div className="card-title">Connected ({repos.length})</div>
          {repos.length === 0 ? (
            <EmptyState title="None yet" body="Connect your first repo to build and test it here." />
          ) : (
            <table>
              <thead><tr><th>Repo</th><th>Status</th><th>App</th></tr></thead>
              <tbody>
                {repos.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/repos/${r.id}`}>{r.owner}/{r.repo}</Link><br /><span className="small muted">{r.branch}{r.subdir ? ` · ${r.subdir}` : ""}</span></td>
                    <td><Badge tone={r.status === "live" ? "minor" : r.status === "failed" ? "failed" : undefined}>{r.status}</Badge></td>
                    <td className="small">{r.appUrl ? <a href={r.appUrl} target="_blank" rel="noreferrer">open</a> : <span className="muted">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
