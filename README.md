# GhostQA - the AI that circles back with proof

[![Built with Muse Code](https://img.shields.io/badge/Built%20with-Muse%20Code-0668E1?logo=meta)](https://dev.meta.ai/lp/muse-code)

**One agent. Three perspectives. A closed loop from customer problem to verified fix.**

GhostQA (repo: `circle-back`) is an autonomous product-quality engineer built for the
Meta Global AI Developer Hackathon 2026. It investigates a real app like a combination of
a software engineer, a security tester, a usability researcher, and a first-time user,
then proves the fix worked by re-running the same journey.

Live prod: https://ghostqa-portal-ehfuotlisq-uc.a.run.app (ask the team for the dashboard passphrase).

## The core loop (the whole product in 6 steps)

1. **Ticket in** - a customer problem arrives ("checkout button does nothing").
2. **Investigate** - the agent reproduces it in the real app: functional run,
   first-time-user simulation, accessibility and safe security checks.
3. **Room** - evidence (screenshots, repro steps, logs, diagnosis) lands in a shared
   issue room where the team discusses and approves one instruction.
4. **Fix** - the approved instruction goes to the team's coding agent (via MCP) or a
   manual patch.
5. **Verify** - GhostQA re-runs the exact same journey and diffs before/after.
6. **Circle back** - the ticket gets a resolution package: what broke, what changed,
   proof it works now.

> A system that only produces insightful reports is another analysis tool.
> A system that finds a problem, helps fix it, and independently verifies the
> improvement demonstrates an autonomous engineering workflow. That is the demo.

## Product suite (what each piece does)

| Piece | Path | Job |
|---|---|---|
| Portal (dashboard) | `apps/portal/` | Tickets, issue rooms, evidence viewer, approvals, run/verify triggers. Next.js. Login-gated in prod, open locally. |
| Agent engine | `services/agent-engine/` | The autonomous loop: drives the app with Playwright, simulates a naive user, analyzes evidence, writes reports, verifies fixes. Exposes an HTTP service in prod, same runs as the CLI. |
| Demo target | `apps/demo-target/` | ShopFast: an intentionally buggy store (1 functional bug, confusing checkout journey, a11y gaps). The app GhostQA tests. Ships a fixed build for the verify step. |
| MCP server | `services/mcp-server/` | Lets any coding agent (Muse Code and others) pull findings with repro steps and push fixes back for verification. |
| Runtime Guardian | `apps/portal/app/guardian/` + engine `guardian.ts`, `workorders.ts`, `nightshift.ts`, `signals.ts`, `pentest.ts`, `sweep.ts`, `zoom.ts` | Post-deploy suite: incidents, work orders, Night Shift, customer signals, pen-test reports, continuous sweeps, Zoom bots, push alerts. |
| Connected repos | `apps/portal/app/repos/` + `lib/repos.ts`, `lib/github.ts`, `lib/gcp.ts` | GitHub native integration: connect a repo, Cloud Build compiles it, Cloud Run hosts it, a ticket files itself, investigation runs, commit status posts back. |
| Data layer | Firestore / JSON files | Tickets, rooms, messages, approvals, runs. Firestore in prod, JSON files in `apps/portal/.data` locally. Same interface, selected by `PORTAL_STORE`. |

Typical flow: file a ticket in the portal, press Run investigation, watch the engine
drive the demo store, review 6 seeded findings with screenshots and repro steps,
approve a fix instruction, flip the demo to its fixed build, press Verify, and read
the before/after proof.

## Where things run (Firebase and Google Cloud)

One Google Cloud project holds everything. Firebase is not a separate host here,
it is the data/auth layer inside that same project:

| Need | Service | Notes |
|---|---|---|
| Hosting (all 3 apps) | Cloud Run | Portal, engine, demo as separate services. Chosen over Firebase Hosting because the engine needs Playwright/Chromium. |
| Database | Cloud Firestore | Tickets, rooms, messages, approvals, runs. See `docs/FIRESTORE_SCHEMA.md`. |
| File blobs | Cloud Storage | Voice notes, report screenshots, traces. Same bucket the engine uploads reports to. |
| Secrets | Secret Manager | Meta/Baseten keys, engine token, portal passphrase. No `.env` file exists anywhere; the backend reads secrets at runtime. |
| Images/builds | Artifact Registry + Cloud Build | Container images built from `deploy/Dockerfile.*`. |

Local runs need none of this: file store, no login gate, heuristic analysis.

## Meta models (honest status)

Full mapping in [docs/META_STACK.md](docs/META_STACK.md). Rule: a model counts as
used only after a real request succeeds, never from a stub.

| Model | Job | Status |
|---|---|---|
| Muse Spark (`muse-spark-1.3`) | Enriches findings with cause/fix prose | Live with `META_API_KEY` (verified) |
| Muse Wonder (`muse-wonder-1.0`) | Deep-dive tier for hard findings | Live (M5) |
| Muse Image (`muse-image-1.0`) | Evidence-linked UI redesigns | Live: PNGs for first 2 usability findings (M2) |
| Muse Voice (`muse-voice-transcribe-1.0`) | Voice bug reports to tickets | Live: voice-first tickets (M4) |
| SAM 3.1 (`sam-3-1`) | Screenshot grounding boxes | Live in `findings[].grounding` (M3) |
| Muse Glimmer (open weights) | Ticket triage | Live when reachable, heuristic fallback (M6) |
| Muse Spark Open (open weights) | Second-opinion analyst | Live via Baseten (M7) |
| Muse Code | Wrote this repo; consumes MCP fix packets | Live |

Without keys the whole loop still runs end to end in heuristic mode, honestly
labeled (`analysisSource: heuristic` on every finding).

## Judges quickstart (run it locally, no keys needed)

Prereqs: Node.js 20+ and npm. Three terminals, all from the repo root.

```bash
# Terminal 1: the buggy demo store
npm install --workspace apps/demo-target
npm run demo:target
# -> http://localhost:3101 (ShopFast, buggy build)

# Terminal 2: the agent engine (HTTP service)
npm install --workspace services/agent-engine
npm exec --workspace services/agent-engine -- playwright install chromium
npm run serve --workspace services/agent-engine
# -> http://localhost:3103 (engine API; local file reports)

# Terminal 3: the dashboard (no login needed locally)
npm install --workspace apps/portal
npm run portal:dev
# -> open http://localhost:3102 in a browser
```

Then click through the loop (about 3 minutes):

1. On the dashboard, file a ticket: subject `Checkout button does nothing`,
   body `Customer tried 3 times, gave up.`, target `http://localhost:3101`.
   A room opens immediately.
2. On the ticket page press **Run investigation**, wait about a minute, refresh.
   Expect **6 findings**: 1 blocker (checkout 500), 2 usability, 2 accessibility,
   1 security surface note, each with repro steps and screenshots.
3. Approve any finding's fix instruction to see the approval flow.
4. For the verify step: stop Terminal 1, restart it with
   `npm run dev:fixed --workspace apps/demo-target` (same URL, fixed build),
   then press **Verify fix** on the ticket page. Expect the before/after diff
   showing findings fixed.
5. For Runtime Guardian: open `/guardian`, press **Simulate attack**, then **Analyze now**,
   approve a response on the incident page, and **Verify containment**. Then propose a
   work order from the incident, approve it, and press **Run Night Shift now** on
   `/guardian/night` to watch autonomous execution with proofs and a morning digest.
6. Prefer the CLI? `npm run agent:run -- --target http://localhost:3101`
   writes the same report to `services/agent-engine/reports/<timestamp>/`.

Tests: `npm test` (engine regression + server + MCP smoke), plus
`npm run typecheck --workspace services/agent-engine` and
`npm run typecheck --workspace apps/portal`.

## Live-model mode (optional)

Set keys as plain environment variables in the terminal before starting the
engine (there is deliberately no `.env` file):

```bash
export META_API_KEY=... META_API_BASE_URL=https://api.meta.ai/v1
```

The same investigation then upgrades from heuristic analysis to Muse Spark
diagnosis. In prod, keys come from Secret Manager instead; see
[docs/META_STACK.md](docs/META_STACK.md) for the full secret list.

## Repo map

| Path | What it is |
|---|---|
| `apps/demo-target/` | ShopFast: intentionally buggy demo store. Run it first. |
| `services/agent-engine/` | The autonomous loop: explore, simulate user, analyze, report, verify. |
| `services/mcp-server/` | MCP adapter for coding agents. |
| `apps/portal/` | Issue rooms UI. |
| `deploy/` | Dockerfiles for the three Cloud Run services. |
| `docs/` | Architecture, demo script, Meta stack mapping, Firestore schema, roadmap. |
| `AGENTS.md` | Working notes for AI coding sessions on this repo. |

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system design, agent roles, data flow
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) - the 5-minute judging demo, beat by beat
- [docs/META_STACK.md](docs/META_STACK.md) - every Meta model/API and where it is used
- [docs/FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md) - database collections
- [docs/ROADMAP.md](docs/ROADMAP.md) - what is deliberately *not* in the hackathon build
  (Zoom agent, pentest, crypto review, mobile) and why

## Scope honesty

The hackathon build covers **web apps only**, one demo target, simulated (not live)
support ingestion, and safe, authorized checks only. No remote control, no "certified
secure" claims, no custom video service. Full rationale in `docs/ROADMAP.md`.

## Built with Meta

Every line of this repo was written with [Muse Code by Meta](https://dev.meta.ai/lp/muse-code),
the AI coding agent powered by Meta Muse Spark - look for the `Built-with` trailer in
the commit history. The product runs on Meta Model API models (Spark, Wonder, Image,
Voice Transcribe, SAM 3.1), open-weight Muse Glimmer and Muse Spark Open, with
Muse Code as the coding agent that consumes our MCP fix packets. Full mapping in
[docs/META_STACK.md](docs/META_STACK.md).
