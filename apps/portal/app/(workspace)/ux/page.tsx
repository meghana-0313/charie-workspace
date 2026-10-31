import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { readFindings } from "@/lib/engine";
import { readBriefs } from "@/lib/guardian";
import { RedesignBriefs } from "@/components/evidence";
import { UxReviewButton } from "@/components/scans";
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
        crumbs={[["/", "Home"], ["/ux", "UX and redesign"]]}
        title="UX and redesign"
        sub="Every usability finding from your investigations, paired with written improvement directions and generated screen alternatives."
      />
      <div className="card">
        <div className="card-title">Start a UX review</div>
        <UxReviewButton />
      </div>
      <div className="card">
        <div className="card-title">Redesign briefs ({total})</div>
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
    </>
  );
}
