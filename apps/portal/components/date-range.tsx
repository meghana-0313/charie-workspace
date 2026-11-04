// Timeframe filter: presets plus a custom start/end date picker.
// Drives the URL (?from=YYYY-MM-DD&to=YYYY-MM-DD) so server pages filter.
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({ label = "Timeframe" }: { label?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const current = params.get("from") || params.get("to") ? "Custom range" : "Last 7 days";

  function apply(f: string, t: string) {
    const q = new URLSearchParams(params.toString());
    if (f) q.set("from", f); else q.delete("from");
    if (t) q.set("to", t); else q.delete("to");
    router.push(q.toString() ? `${path}?${q.toString()}` : path);
  }
  function preset(days: number | null) {
    if (days === null) return apply("", "");
    const now = new Date();
    apply(iso(new Date(now.getTime() - (days - 1) * 864e5)), iso(now));
  }

  return (
    <details className="date-range">
      <summary className="btn secondary sm" aria-label={`${label}: ${current}`}>{label}: {current}</summary>
      <div className="date-range-panel">
        <div className="row">
          <button type="button" className="secondary sm" onClick={() => preset(1)}>Today</button>
          <button type="button" className="secondary sm" onClick={() => preset(7)}>Last 7 days</button>
          <button type="button" className="secondary sm" onClick={() => preset(30)}>Last 30 days</button>
          <button type="button" className="secondary sm" onClick={() => preset(null)}>All time</button>
        </div>
        <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
          <label className="small" style={{ margin: 0 }}>Start <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="small" style={{ margin: 0 }}>End <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button type="button" className="sm" onClick={() => apply(from, to)}>Apply</button>
        </div>
      </div>
    </details>
  );
}
