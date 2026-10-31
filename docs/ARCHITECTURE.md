# Architecture

## Design principles

1. **Evidence over assertions.** Every finding links to a screenshot, an action trace,
   and a reproducible script. No finding without a repro.
2. **Verify, don't trust.** A fix is only "fixed" when the same journey passes on the
   new build with no new regressions in the tested scope.
3. **Simulation ≠ human.** AI usability results are always labeled as simulation, with
   an optional human-validation step that measures real completion rates.
4. **Safe by default.** All checks run against a URL or build the customer explicitly
   scoped. No remote control in the hackathon build; destructive/security tests are
   opt-in, read-only where possible, and report confidence + limitations.

## System overview

```text
 support ticket / task goal
        │
        ▼
 ┌──────────────┐   ┌──────────────────┐   ┌───────────────────┐
 │   Explorer   │──▶│  Usability Sim   │──▶│  Evidence Analyst │
 │ (Playwright) │   │ (first-time user)│   │ (Muse Spark)      │
 └──────┬───────┘   └────────┬─────────┘   └─────────┬─────────┘
        │  traces, screenshots, console + network logs            │
        └────────────────────┬──────────────────────┬────────────┘
                             ▼                      ▼
                      ┌──────────────┐      ┌────────────────┐
                      │ Issue Room   │◀────▶│  Team + coding │
                      │ (portal)     │ MCP  │  agent         │
                      └──────┬───────┘      └────────────────┘
                             │ approved fix lands in a new build
                             ▼
                      ┌──────────────┐
                      │   Verifier   │──▶ before/after diff ──▶ ticket updated
                      │ (re-run loop)│
                      └──────────────┘
```

## Agent roles (all in `services/agent-engine/`)

| Role | File | Job | Model |
|---|---|---|---|
| Machine tester / Explorer | `src/explorer.ts` | Drives the real app with Playwright toward a goal; records every action, screenshot, console error, failed request | deterministic script + Spark planner (later) |
| First-time-user sim | `src/usability.ts` | Re-runs the goal *without* privileged knowledge of the UI; records hesitation signals: backtracks, repeated clicks, dwell, detours, abandonment | heuristics now; Spark vision-driven in v1 |
| Evidence analyst | `src/analyst.ts` | Turns traces into findings: severity, likely cause, affected component, repro steps, confidence | Muse Spark (`META_TEXT_MODEL`) |
| Design improver | `src/redesign.ts` | For usability findings: 2-3 alternative UI directions + trade-offs + component-level implementation plan | Muse Image + Spark |
| Fix proposer | (analyst output) | Machine-readable instruction packet for the coding agent via MCP | Spark |
| Verifier | `src/verifier.ts` | Re-runs identical journeys against the fixed build; passes only if target finding is gone and no regressions | deterministic |

## Data flow per run

1. Run config: `{ targetUrl, goal, tasks[], scope, buildId }`.
2. Explorer produces `trace.json` (actions + assertions + artifacts).
3. Usability sim produces `usability.json` (confusion signals per step).
4. Analyst produces `findings.json` (typed findings with severity/confidence/evidence links).
5. Reporter writes `report.md` + static HTML + per-finding MCP packets.
6. After a fix: verifier re-runs steps 2-4 against `fixedBuildUrl`, writes `verification.json`
   with a before/after diff. Finding state transitions `open → fix_proposed → verified|regressed`.

## Finding type

```ts
type Finding = {
  id: string;                 // stable across re-runs of the same journey
  category: "functional" | "usability" | "accessibility" | "security" | "change-impact";
  severity: "blocker" | "major" | "minor";
  title: string;
  goal: string;               // the user task that failed
  reproSteps: string[];       // human-readable, numbered
  evidence: { screenshots: string[]; trace: string; logs: string[] };
  suspectedCause: string;
  confidence: "high" | "medium" | "low";
  suggestedFix: string;       // instruction-ready for a coding agent
  regressionCheck: string;    // how the verifier will confirm the fix
  status: "open" | "fix_proposed" | "verified" | "regressed";
};
```

## Environments

- `apps/demo-target` - seeded-bug store used for the demo and for regression-testing
  the engine itself. The engine's own CI runs the loop against it; if the seeded bug
  is *not* found, the engine regressed.
- Customer apps (post-hackathon): any scoped web URL + optional source upload.

## What lives where (target state)

- Firestore: tickets, rooms, messages, findings, runs, verifications.
- Cloud Storage: screenshots, recordings, traces, generated redesigns.
- Portal (Next.js): rooms UI, report viewer, approvals.
- MCP server: `findings.get`, `findings.list`, `fix.submit`, `verification.get`.
