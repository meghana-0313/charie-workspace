// Shared modal shell, extracted from the command palette pattern.
// Backdrop click and Escape close; panel clicks do not propagate.

"use client";

import { useEffect, useState } from "react";
import { NewTicketForm } from "./forms";

export function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
          <strong style={{ fontSize: "var(--text-lg)" }}>{title}</strong>
          <button type="button" className="ghost sm" onClick={close} aria-label="Close dialog">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** New investigation, in place: no page navigation away from your context. */
export function NewInvestigationButton({ defaultTarget = "", label = "+ New investigation", className = "btn", autoOpen = false }: {
  defaultTarget?: string; label?: string; className?: string; autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <Modal title="New investigation" close={() => setOpen(false)}>
          <p className="muted small" style={{ marginTop: 0 }}>
            Describe the customer problem, or hold the mic and talk. A ticket room opens and the investigation starts by itself.
          </p>
          <NewTicketForm
            defaultTarget={defaultTarget}
            onSuccess={(id) => { setOpen(false); location.href = `/tickets/${id}`; }}
          />
        </Modal>
      )}
    </>
  );
}
