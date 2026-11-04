import { listReportSummaries } from "@/lib/reports";
import { ReportBrowser } from "@/components/report-browser";
import { identity, scopeUid } from "@/lib/who";

export const metadata = { title: "Reports - Charie" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const uid = scopeUid(await identity());
  const { from, to } = await searchParams;
  const all = await listReportSummaries(uid);
  const reports = all.filter((r) => (!from || r.at.slice(0, 10) >= from) && (!to || r.at.slice(0, 10) <= to));
  const failed = reports.filter((r) => r.status === "failed").length;
  const critical = reports.filter((r) => r.severity === "critical" || r.severity === "blocker").length;
  return (
    <div>
      <div className="page-head">
        <h1>Reports</h1>
        <p className="page-sub">{reports.length} report(s){from || to ? " in this timeframe" : ""}{failed > 0 ? ` · ${failed} failed` : ""}{critical > 0 ? ` · ${critical} critical` : ""}. Open one for the full story: what it was for, what went in, what happened, and what came out.</p>
      </div>
      <ReportBrowser reports={reports} />
    </div>
  );
}
