// Visual evidence: SAM grounding boxes overlaid on screenshots and
// Muse Image redesign alternatives. Server components, no JS shipped.

import type { BriefView, FindingView } from "@/lib/types";

type Box = { x: number; y: number; width: number; height: number; label: string };

const clampPct = (v: number) => Math.min(100, Math.max(0, v));

/** Screenshot with 0-1000 normalized grounding boxes drawn on top. */
export function GroundedShot({ src, alt, boxes }: { src: string; alt: string; boxes: Box[] }) {
  return (
    <span className="shot-wrap">
      <a href={src} target="_blank" rel="noreferrer" title="Click to view full size"><img className="shot thumb" src={src} alt={alt} /></a>
      {boxes.length > 0 && <span className="gbox-source">Grounded by SAM 3.1</span>}
      {boxes.map((b, i) => (
        <span
          key={i}
          className="gbox"
          title={b.label}
          style={{
            left: `${clampPct(b.x / 10)}%`,
            top: `${clampPct(b.y / 10)}%`,
            width: `${clampPct(b.width / 10)}%`,
            height: `${clampPct(b.height / 10)}%`,
          }}
        >
          <span className="gbox-label">{b.label}</span>
        </span>
      ))}
    </span>
  );
}

/** Pick the grounding entry for one screenshot file, if any. */
export function boxesFor(f: FindingView, shot: string): Box[] {
  const g = (f.grounding ?? []).find((e) => e.screenshot === shot);
  return g?.boxes ?? [];
}

/** Redesign briefs: written directions plus Muse Image alternatives. */
export function RedesignBriefs({ briefs, runId }: { briefs: BriefView[]; runId: string }) {
  if (briefs.length === 0) return null;
  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
      <h3>Redesign briefs ({briefs.length})</h3>
      {briefs.map((b) => (
        <div key={b.findingId} style={{ marginBottom: 12 }}>
          <p className="small"><code>{b.findingId}</code> · {b.componentPlan}</p>
          <ul className="small">
            {b.directions.map((d) => (
              <li key={d.name}><strong>{d.name}:</strong> {d.change} <span className="muted">Trade-off: {d.tradeoff}</span></li>
            ))}
          </ul>
          {b.images.length > 0 ? (
            <div className="row">
              {b.images.map((img) => (
                <a key={img} href={`/api/artifacts/${runId}/${img}`} target="_blank" rel="noreferrer" title="Click to view full size"><img className="shot thumb" src={`/api/artifacts/${runId}/${img}`} alt={`${b.findingId} redesign`} /></a>
              ))}
            </div>
          ) : (
            <p className="small muted">Written brief only. Visual alternatives generate when Muse Image is keyed.</p>
          )}
        </div>
      ))}
    </div>
  );
}
