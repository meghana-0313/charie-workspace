import Link from "next/link";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { ScheduleForm, ScheduleRow, TickButton } from "@/components/autopilot";
import { EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AutopilotPage() {
  const schedules = await store.listSchedules(scopeUid(await identity()));
  const ticking = Boolean(process.env.CRON_KEY);
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/autopilot", "Autopilot"]]}
        title="Autopilot"
        sub="Charie working while you are away. Schedules run on their own; new tickets investigate themselves; pushed branches rebuild and retest."
      />
      <div className="grid2">
        <div className="card">
          <div className="card-title">Add a schedule</div>
          <ScheduleForm />
          <p className="small muted" style={{ marginTop: 10 }}>
            {ticking
              ? "The platform ticker runs every 15 minutes and executes whatever is due."
              : "No platform ticker here (local run): use Run due now, or schedule the cron tick in prod."}
          </p>
        </div>
        <div className="card">
          <div className="card-title">Always-on behavior</div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>New tickets start investigating the moment they are filed.</li>
            <li>Connected repos with a webhook rebuild and retest on every push. See <Link href="/repos">Test a repo</Link>.</li>
            <li>Night shift executes approved fix tasks overnight with proofs.</li>
          </ul>
          <div style={{ marginTop: 12 }}><TickButton /></div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Schedules ({schedules.length})</div>
        {schedules.length === 0 ? (
          <EmptyState title="Nothing scheduled" body="Add a sweep or a nightly shift above and Charie takes it from there." />
        ) : (
          <table>
            <thead><tr><th>What</th><th>Every</th><th>Last run</th><th></th></tr></thead>
            <tbody>
              {schedules.map((s) => (
                <ScheduleRow key={s.id} id={s.id} kind={s.kind} preset={s.preset} enabled={s.enabled} lastRunAt={s.lastRunAt} lastStatus={s.lastStatus} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
