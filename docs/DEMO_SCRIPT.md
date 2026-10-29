# Demo script (5 minutes, for judges)

**Setup:** demo-target running on `localhost:3101`, agent-engine ready. No API keys
required for the deterministic core; with `META_API_KEY` the diagnosis and redesigns
upgrade to live Meta models.

## Beat 1 — The ticket (30s)

Show the support ticket:

> "Checkout button does nothing. Customer tried 3 times, gave up. Order lost."

Say: *"Every support team knows this ticket. Today it burns support time, then
engineering repro time, then back-and-forth. Watch the whole thing close itself."*

## Beat 2 — The agent investigates (90s)

Run:

```bash
npm run agent:run
```

Narrate while it runs: the machine tester drives the real store, adds 3 items, hits
checkout; the first-time-user sim tries the same goal without knowing the UI. Point at
screenshots appearing in `reports/<ts>/`.

## Beat 3 — Evidence, not vibes (60s)

Open `report.md`:

- **Finding #1 (functional, blocker):** "Place order silently fails with 3+ items" —
  repro steps, failed `POST /api/checkout` (500), swallowed error, screenshot.
- **Finding #2 (usability, major):** "Two identical 'Continue' buttons; user sim
  clicked the wrong one twice" — action trace + hesitation signals.
- **Finding #3 (accessibility, major):** "Place-order control not keyboard reachable."

Say: *"Three perspectives, one trace. And note the label: AI simulation, not a claim
about real humans — human validation is a separate step."*

## Beat 4 — The fix + the redesign (45s)

Show the MCP fix packet for finding #1 (paste-ready for Muse Code / any coding agent)
and the Muse Image redesign alternatives for the checkout step with trade-offs.

## Beat 5 — Verified (45s)

Flip the demo-target to the fixed build (`FIXED_BUILD=1 npm run demo:target`), run:

```bash
npm run agent:run -- --verify-against http://localhost:3101
```

Show `verification.json`: finding #1 gone, journey completes, no regressions.
Ticket state: `verified`.

**Closer:** *"Ticket to proof-of-fix, one loop. That's GhostQA: it circles back."*

## If something breaks live

Fall back to the checked-in sample: `services/agent-engine/sample-report/` — a real
past run's report + screenshots. Never fake a live run; narrate the recording as a
recording.
