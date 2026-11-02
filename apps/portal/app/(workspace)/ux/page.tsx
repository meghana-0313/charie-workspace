import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { readFindings } from "@/lib/engine";
import { readBriefs } from "@/lib/guardian";
import { RedesignBriefs } from "@/components/evidence";
import { UxReviewButton } from "@/components/scans";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UxPage() {
  const myUid = scopeUid(await identity());
  const runs = await store.listRuns(20, myUid);
  const withBriefs = (
    await Promise.all(
      runs.map(async (r) => {
        const briefs = await readBriefs(r.id);
        if (briefs.length === 0) return null;
        const findings = (await readFindings(r.id)) ?? [];
        const titles = new Map(findings.map((f) => [f.id, f.title]));
        return { run: r, briefs, titles };
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);
  const total = withBriefs.reduce((n, w) => n + w.briefs.length, 0);

  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/ux", "UX Review"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="eye" size={19} /></span> UX Review</>}
        sub="Every usability finding from your investigations, paired with written improvement directions and generated screen alternatives."
      />
      <div className="stats">
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="eye" size={20} /></span><div><div className="stat-num">{total}</div><div className="stat-label">Redesign briefs</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="search" size={20} /></span><div><div className="stat-num">{withBriefs.length}</div><div className="stat-label">Runs with findings</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="layers" size={20} /></span><div><div className="stat-num">{runs.length}</div><div className="stat-label">Runs reviewed</div></div></div></div>
        <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="spark" size={20} /></span><div><div className="stat-num">{total > 0 ? "Ready" : "Idle"}</div><div className="stat-label">Alternatives generated</div></div></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-4)", alignItems: "start" }} className="home-grid">
        <div className="card">
          <div className="card-title">Before and after: redesign briefs ({total})</div>
          {total === 0 ? (
            <EmptyState title="No briefs yet" body="Run an investigation on a ticket first; usability findings produce briefs automatically." />
          ) : (
            withBriefs.map(({ run, briefs, titles }) => (
              <div key={run.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                <p className="small muted">
                  <Link href={`/tickets/${run.ticketId}`}><code>{run.id.slice(0, 19)}</code></Link> · {briefs.length} brief(s)
                </p>
                {briefs.map((b) => (
                  <p key={b.findingId} className="small">
                    <strong>{titles.get(b.findingId) ?? b.findingId}</strong> <Badge>usability</Badge>
                  </p>
                ))}
                <RedesignBriefs briefs={briefs} runId={run.id} />
              </div>
            ))
          )}
        </div>
        <div className="card">
          <div className="card-title"><span className="icon-orb violet"><Icon name="play" /></span> Start a UX review</div>
          <p className="small muted">Charie walks the live page like a new user, flags friction, and drafts redesign directions with generated alternatives.</p>
          <UxReviewButton />
        </div>
      </div>
    </>
  );
}
