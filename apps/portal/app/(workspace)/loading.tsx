// Instant navigation feedback: App Router shows this the moment a tab is
// clicked while the destination page renders on the server, so a click
// always responds immediately instead of looking ignored (pages are
// force-dynamic and some wait on engine lists).
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ width: 240, height: 26, marginBottom: 8 }} />
          <div className="skel" style={{ width: 420, maxWidth: "80%", height: 14 }} />
        </div>
        <div className="skel" style={{ width: 120, height: 32 }} />
      </div>
      <div className="grid3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card">
            <div className="skel" style={{ width: "55%", height: 14, marginBottom: 10 }} />
            <div className="skel" style={{ width: "85%", height: 22, marginBottom: 8 }} />
            <div className="skel" style={{ width: "70%", height: 12 }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: "var(--space-4)" }}>
        <div className="skel" style={{ width: "40%", height: 14, marginBottom: 10 }} />
        <div className="skel" style={{ width: "92%", height: 12, marginBottom: 8 }} />
        <div className="skel" style={{ width: "88%", height: 12, marginBottom: 8 }} />
        <div className="skel" style={{ width: "60%", height: 12 }} />
      </div>
    </div>
  );
}
