"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Demo Mode strip: says plainly what is sample data and what is live. */
export function DemoBanner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/demo/reset", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setDone(true);
      router.refresh();
    }
  }

  return (
    <div className="demo-banner" role="status">
      <span>
        <strong>DEMO WORKSPACE</strong> - Sample data and simulated integrations. Live AI actions (chat, investigations, call vision) use real Meta models when configured.
      </span>
      <span className="row" style={{ gap: 8 }}>
        {done && <span className="small">Reset done.</span>}
        <button type="button" className="ghost sm" onClick={reset} disabled={busy}>
          {busy ? "Resetting…" : "Reset Demo Workspace"}
        </button>
      </span>
    </div>
  );
}
