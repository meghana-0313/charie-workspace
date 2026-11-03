import { listReportSummaries } from "@/lib/reports";
import { ReportBrowser } from "@/components/report-browser";
import { identity, scopeUid } from "@/lib/who";

export const metadata = { title: "Reports - Charie" };

export default async function ReportsPage() {
  const uid = scopeUid(await identity());
  const reports = await listReportSummaries(uid);
  return (
    <div>
      <div className="page-head">
        <h1>Reports</h1>
        <p className="page-sub">Every run gets its own report. Open one for the full story: what it was for, what went in, what happened, and what came out.</p>
      </div>
      <ReportBrowser reports={reports} />
    </div>
  );
}
