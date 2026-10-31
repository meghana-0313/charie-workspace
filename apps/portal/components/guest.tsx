// Guest lobby: public support-call entry. Collects name + issue + consent,
// files a support ticket for team context, then joins the room as a guest.
// Guests never see the workspace; calls are never recorded or stored.

"use client";

import { useState } from "react";
import { CharieMark } from "./mark";
import { MeetRoom } from "./meet";

export function GuestLobby({ roomId, roomTitle, token }: { roomId: string; roomTitle: string; token: string }) {
  const [name, setName] = useState("");
  const [issue, setIssue] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !issue.trim() || !consent || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/meet/rooms/${roomId}/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, name: name.trim(), issue: issue.trim(), consent }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Check-in failed. Your invite may have expired; ask the team for a fresh link.");
      return;
    }
    setCheckedIn(true);
  }

  if (checkedIn) {
    return (
      <main className="content" style={{ maxWidth: 980 }}>
        <h1 className="page-title" style={{ marginBottom: 12 }}>{roomTitle}</h1>
        <MeetRoom roomId={roomId} roomTitle={roomTitle} token={token} initialName={name.trim()} />
      </main>
    );
  }

  return (
    <main className="content" style={{ maxWidth: 560 }}>
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="side-mark"><CharieMark /></span>
          <strong style={{ fontSize: "var(--text-lg)" }}>CHARIE support call</strong>
        </div>
        <p className="muted small">
          You are joining <strong>{roomTitle}</strong>. Tell us your name and the issue so the
          team (and Charie) has context when you arrive.
        </p>
        <form onSubmit={join}>
          <label htmlFor="gname">Your name</label>
          <input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada" />
          <label htmlFor="gissue">What is going wrong?</label>
          <textarea
            id="gissue"
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Checkout fails with an error after I enter my card."
          />
          <label className="row small" style={{ fontWeight: 400, marginTop: 10 }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I agree to this support call. I understand it is not recorded, transcribed, or stored.
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button disabled={busy || !name.trim() || !issue.trim() || !consent}>
              {busy ? "Checking in…" : "Join the call"}
            </button>
            {error && <span className="small" style={{ color: "var(--danger)" }}>{error}</span>}
          </div>
        </form>
        <p className="muted small" style={{ marginTop: 12 }}>
          Privacy: only your name and issue description are kept, on the support ticket.
          Video and audio stay between call participants and are never saved.
        </p>
      </div>
    </main>
  );
}
