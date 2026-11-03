# Meet CHARIE: Autonomous Engineering Intelligence

[![Built with Muse Code](https://img.shields.io/badge/Built%20with-Muse%20Code-0668E1?logo=meta)](https://dev.meta.ai/lp/muse-code)

**Your software's autonomous companion.**

Charie (repo: `charie-workspace`) is an autonomous engineering team built for the
Meta Global AI Developer Hackathon 2026. File a customer problem and Charie
investigates the real app, proposes fixes, proves they worked, watches
production for threats, and meets with you on video. One workspace, three
products:

| Product | Job | Where |
|---|---|---|
| Charie Build | QA, testing, debugging and engineering | Home, Test a repo, Tickets and fixes, UX and redesign, Accessibility, First run |
| Charie Guard | Runtime security and threat response | Threats, Fix tasks, Security tests |
| Charie Ops | Production intelligence and reliability | Live signals, Night shift, Meet |

## Why Charie stands out (the wow factors)

Existing tools each do one slice: a test runner, a pentest scanner, a meeting
bot, a ticket queue. Charie closes the whole loop in one workspace, and
proves every step instead of just reporting it:

1. **Ticket to evidence to fix to proof.** Charie drives the real app like a
   first-time user, files screenshots and repro steps, gets human approval,
   fixes, then re-runs the exact journey and diffs before/after.
2. **Charie joins your video call.** In Meet she listens (with consent),
   answers questions out loud, proposes actions as consent cards, and never
   runs anything until a human approves. Camera starts off; she is a
   participant, not a recorder.
3. **She works while you sleep.** Night Shift, Autopilot, live signals and
   continuous sweeps watch production, triage threats, and leave a morning
   digest with fix tasks ready for approval.
4. **Graded, not vibes.** Accessibility grades, first-run scores, a 35-check
   security suite with recon and OWASP coverage, and UX redesigns generated
   as real screens you can approve, not text suggestions.
5. **Your coding agent is in the loop.** Over MCP (cloud or local) agents
   pull findings and fix packets, and must check verification proof before
   calling a fix done. Jira and GitHub sync both ways.
6. **Chat is an operator, not a chatbot.** Chat with Charie uses tools:
   she files tickets, runs scans, reads findings and checks builds, with a
   receipt for every action. Meet Charie runs the exact same brain.

## Which credits does Charie use?

- **Chat and Meet conversations: Baseten credits first.** Both go through
  the same chat loop to the engine, which calls Muse Spark Open
  (`meta-models/muse-spark-open-1026`) at `https://inference.baseten.co/v1`
  when `BASETEN_API_KEY` resolves (env first, then GCP Secret Manager).
  That is your Baseten credit balance at work, and the reply model field
  says `(baseten)` so you can see it. If Baseten is down it falls back to
  Meta Muse Spark (`muse-spark-1.3`, Meta credits), then to the free
  built-in heuristic, labelled `heuristic`. Baseten also re-grades
  investigation findings as a second opinion.
- **Meet human voice: Modal credits.** Charie speaks with Kokoro-82M on
  Modal (warm male voice `am_michael`, see `services/modal-tts/`). Deploy
  it with `modal deploy services/modal-tts/modal_app.py` and set
  `CHARIE_TTS_URL` on the portal. Until then she uses the best local male
  browser voice. Speech recognition still runs free in the browser.
- Speech is written to be spoken: short sentences, contractions, and a
  speakable-text pass strips markdown, links, and ticket ids before any
  voice reads a reply aloud.

Live prod: https://charie-portal-ehfuotlisq-uc.a.run.app (sign in with Google or email; ask the team for an invite if your account is new).

## Hackathon submission

- **Track:** Indie Developer (solo build).
- **Problem statement:** Push the Frontier. Charie pushes AI autonomy into
  software engineering: an agent that files, investigates, verifies, schedules,
  and syncs fixes across GitHub and Jira with humans approving the
  consequential steps.
- **New work:** everything in this repo was built during the hackathon for this
  submission. Nothing predates it.
- **Every Meta requirement, wired and live in prod when keys resolve** (heuristic, honestly labelled, without them): Muse Spark (investigation reasoning, chat
  agent, incident analysis), Muse Wonder (deep-dive escalation), Muse Image
  (UI redesigns), Muse Voice Transcribe (voice tickets), SAM 3.1 (screenshot
  grounding), Muse Glimmer (triage router), Muse Spark Open (second-opinion
  analyst on Baseten), Muse Code (consumes MCP fix packets). See
  `docs/META_STACK.md` for the file-by-file mapping.
- **Bonus aims:** Best Build on Open Weight Models (Glimmer router + Spark
  Open on Baseten, both live with heuristic fallbacks), Best Agentic
  Use-Case (autopilot, webhooks, night shift, chat tools, verified agent
  loop), Best Creative Build (Image redesigns in the review flow).

## How the suite fits together

One spine runs through the whole workspace: **ticket → evidence → fix → proof**.
Each product runs that spine in its own territory.

**Charie Build: quality before release.**
File a ticket and Charie investigates the real app: functional run,
first-time-user simulation, accessibility, safe security checks. Evidence
(screenshots, repro steps, logs, diagnosis) lands in a shared room, the team
approves one instruction, the fix goes to your coding agent over MCP or lands
as a patch, Charie re-runs the exact journey and diffs before/after, and the
ticket closes with a proof package. UX analysis with generated redesigns,
graded accessibility scans, and first-run scoring all feed the same room.

**Charie Guard: threats answered while you sleep.**
Threats arrive from log watch, SDK reports, continuous sweeps, and the 35
check pentest with recon and OWASP coverage. Each becomes a triaged incident,
the team approves a response, fix tasks execute with proofs attached, and
night shift keeps the loop turning overnight with a morning digest.

**Charie Ops: production that files its own tickets.**
Live user complaints become tickets in one click. Connected GitHub repos
build, deploy, and test themselves on Cloud Run and post results back to the
commit. Meet rooms bring customers into support calls through consent first
guest invites: audio and video are never recorded; opt-in live notes and the transcript are saved to the room and its ticket.

Chat with Charie (Meta Muse Spark, tool-using, receipted) sits on top of all
three loops, and the Marketplace connects Jira (auto-pull, proof sync-back),
GitHub (one-click repos, builds, webhooks), and workspace context.

The connective tissue: a drop-in web SDK plus a documented mobile contract for
prod apps, team seats with scoped logins, API keys for event ingest, and MCP
for coding agents in two flavors: a cloud endpoint on the portal itself
(`POST /api/mcp`, authorized with your ingest key, no local clone needed) and a
local stdio server. The Integrations page generates copy-paste configs for
both. Agents pull findings and fix packets scoped to your account and check
verification proof before they call a fix done. Everything a user creates,
from tickets to pentest reports, is saved per account and survives restarts:
the engine keeps each account's Guardian data in its own partition.

> A system that only produces insightful reports is another analysis tool.
> A system that finds a problem, helps fix it, and independently verifies the
> improvement demonstrates an autonomous engineering workflow. That is the demo.

## Product suite (what each piece does)

| Piece | Path | Job |
|---|---|---|
| Portal (dashboard) | `apps/portal/` | The whole workspace: tickets, rooms, evidence, approvals, scans, meetings. Next.js. Email and password sign-in (Firebase Auth, password reset emails included); one-click local owner for judges. |
| Agent engine | `services/agent-engine/` | The autonomous loop: drives the app with Playwright, simulates a naive user, analyzes evidence, writes reports, verifies fixes. HTTP service in prod, same runs as the CLI. |
| Demo target | `apps/demo-target/` | ShopFast: an intentionally buggy store (1 functional bug, confusing checkout journey, a11y gaps). The app Charie tests. Ships a fixed build for the verify step. |
| MCP server | `services/mcp-server/` + portal `POST /api/mcp` | Lets any coding agent (Muse Code and others) pull findings with repro steps and fix packets and check verification proof. Local stdio from a checkout, or cloud over HTTP with an ingest key; the Integrations page generates both configs. |
| Charie Guard | `apps/portal/app/guardian/` + engine `guardian.ts`, `workorders.ts`, `nightshift.ts`, `signals.ts`, `pentest.ts`, `sweep.ts` | Post-deploy suite: threats, fix tasks, night shift, live signals, security tests, continuous sweeps, push alerts. |
| Charie Meet | `apps/portal/app/guardian/zoom/` + `components/meet.tsx` + `/api/meet/` | Native video rooms (mesh WebRTC, portal-hosted signaling). Join with a live camera preview, start muted, camera off, or audio only; stuck peers time out with a remove option. Guest invite links with consent first support-ticket check-in; calls are never recorded, and opt-in live notes plus the transcript save to the room and its ticket; rooms belong to the account that created them. Charie joins the call itself: she listens, speaks, watches a shared screen in watch mode (change-triggered frames with a timestamped screen memory she can answer questions from), takes live notes, and proposes investigations that only run after a human approves. Zoom bot via Recall.ai stays as the external fallback. |
| Production monitoring | Threats page + engine `logwatch.ts` + `/api/guardian/events` + `public/charie.js` | Log watch reads your GCP project's errors itself; prod web apps report via the drop-in SDK; mobile apps follow `docs/MOBILE_SDK.md`. App keys on the Team page. |
| UX, accessibility, first run | `apps/portal/app/ux|a11y|firstrun/` + engine `redesign.ts`, `a11y.ts`, `firstrun.ts` | UI analysis with generated screen redesigns, 8 accessibility checks with grades, 6 first-time-user checks with scores. |
| Connected repos | `apps/portal/app/repos/` + `lib/repos.ts`, `lib/github.ts`, `lib/gcp.ts` | GitHub native integration: connect a repo, Cloud Build compiles it, Cloud Run hosts it, a ticket files itself, investigation runs, commit status posts back. |
| Data layer | Firestore / JSON files | Tickets, rooms, messages, approvals, runs, meet rooms, signals. Firestore in prod, JSON files in `apps/portal/.data` locally. Same interface, selected by `PORTAL_STORE`. Every record is scoped to the owning account; engine Guardian reports live in per-account partitions (`_guardian/acct/<uid>`). |

Typical flow: file a ticket in the portal, press Run investigation, watch the engine
drive the demo store, review 6 seeded findings with screenshots and repro steps,
approve a fix instruction, flip the demo to its fixed build, press Verify, and read
the before/after proof. Then open UX and redesign for screen alternatives, run an
accessibility scan and a first run test, and start a Meet room to talk it over.
Recurring work lives on Autopilot: sweeps, security re-scans, night shifts, and log
watch run on their own; pushed branches rebuild and retest via webhooks.

## Where things run (Firebase and Google Cloud)

One Google Cloud project holds everything. Firebase is not a separate host here,
it is the data/auth layer inside that same project:

| Need | Service | Notes |
|---|---|---|
| Hosting (all 3 apps) | Cloud Run | `charie-portal`, `charie-engine`, `charie-demo`. Chosen over Firebase Hosting because the engine needs Playwright/Chromium. |
| Database | Cloud Firestore | Tickets, rooms, messages, approvals, runs, meet rooms. See `docs/FIRESTORE_SCHEMA.md`. |
| File blobs | Cloud Storage | Voice notes, report screenshots, traces. Bucket name keeps the historic `-ghostqa` suffix (internal only). |
| Secrets | Secret Manager | Meta/Baseten keys, engine token, session key, Firebase web config. No `.env` file exists anywhere; the backend reads secrets at runtime. |
| Images/builds | Artifact Registry + Cloud Build | Container images in the `charie` repo, built from `deploy/Dockerfile.*`. CI deploys on every push to dev. |

Local runs need none of this: file store and the local-owner dev login on the login page (no Firebase needed), heuristic analysis until you add keys.

## Meta models (honest status)

Full mapping in [docs/META_STACK.md](docs/META_STACK.md). Rule: a model counts as
used only after a real request succeeds, never from a stub.

| Model | Job | Status |
|---|---|---|
| Muse Spark (`muse-spark-1.3`) | Enriches findings with cause/fix prose | Live with `META_API_KEY` (verified) |
| Muse Wonder (`muse-wonder-1.0`) | Deep-dive tier for hard findings | Live (M5) |
| Muse Image (`muse-image-1.0`) | Evidence-linked UI redesigns | Live: PNGs for usability findings, surfaced on UX and redesign (M2) |
| Muse Voice (`muse-voice-transcribe-1.0`) | Voice bug reports to tickets | Live: voice-first tickets (M4) |
| SAM 3.1 (`sam-3-1`) | Screenshot grounding boxes | Live in `findings[].grounding` (M3) |
| Muse Glimmer (open weights) | Ticket triage | Live when reachable, heuristic fallback (M6) |
| Muse Spark Open (open weights) | Second-opinion analyst | Live via Baseten (M7) |
| Muse Code | Wrote this repo; consumes MCP fix packets | Live |

Without keys the whole loop still runs end to end in heuristic mode, honestly
labeled (`analysisSource: heuristic` on every finding).

## Judges quickstart (run it locally, no keys needed)

Prereqs: Node.js 20+ and npm. One install at the root, then three terminals, all from the repo root.

```bash
npm install

# Terminal 1: the buggy demo store
npm run demo:target
# -> http://localhost:3101 (ShopFast, buggy build)

# Terminal 2: the agent engine (HTTP service)
npm exec --workspace services/agent-engine -- playwright install chromium
npm run serve --workspace services/agent-engine
# -> http://localhost:3103 (engine API; local file reports)

# Terminal 3: the dashboard
npm run portal:dev
# -> open http://localhost:3102 and press Continue as local owner
```

**Zero keys? Everything below still works.** With no API keys at all, the full loop - tickets, investigation with screenshots and repro steps, verify, scans, pentest, Guardian demo, Meet calls with guests and Charie in the room, reports - runs end to end. What changes without keys is only the polish, and it is labelled honestly wherever it appears: finding prose stays heuristic (`analysisSource: heuristic`), chat uses the heuristic router, Charie's call voice uses the browser voice, and screen vision, image redesigns, and voice transcription stay off until `META_API_KEY` and/or `BASETEN_API_KEY` are set (see Live-model mode). Nothing hard-fails for lack of a key.

Then click through the loop (about 5 minutes):

1. On the login page press Continue as local owner (dev only). File a ticket: subject
   `Checkout button does nothing`, body `Customer tried 3 times, gave up.`,
   target `http://localhost:3101`. A room opens immediately.
2. The investigation starts by itself; open the ticket page, wait about a minute, refresh.
   Expect **6 findings**: 1 blocker (checkout 500), 2 usability, 2 accessibility,
   1 security surface note, each with repro steps and screenshots.
3. Open **UX and redesign** in the sidebar: the usability findings appear with
   written briefs (and generated screens with `META_API_KEY`).
4. Open **Accessibility** and scan `http://localhost:3101` for a graded report;
   open **First run** for the new-user score.
5. Approve any finding's fix instruction to see the approval flow.
6. For the verify step: stop Terminal 1, restart it with
   `npm run dev:fixed --workspace apps/demo-target` (same URL, fixed build),
   then press **Verify fix** on the ticket page. Expect the before/after diff
   showing findings fixed.
7. For Charie Guard: open **Threats**, press **Simulate attack**, then **Analyze now**,
   approve a response on the incident page. Then propose a fix task from the
   incident, approve it, and press **Run night shift now** on **Night shift** to
   watch autonomous execution with proofs and a morning digest.
8. Open **Meet**, start a room, join from a second tab, and talk: camera, mic,
   and screen share run peer to peer with no third party.
9. Open **Autopilot** to schedule sweeps and night shifts, and **Coding agents** to hand runs to your AI coding agent.
10. Prefer the CLI? `npm run agent:run -- --target http://localhost:3101`
   writes the same report to `services/agent-engine/reports/<timestamp>/`.

Tests: `npm test` (engine regression + server + guardian + accessibility suites),
plus `npm run typecheck --workspace services/agent-engine` and
`npm run typecheck --workspace apps/portal`.

## Live-model mode (optional)

Set keys as plain environment variables in the terminal before starting the
engine (there is deliberately no `.env` file):

```bash
export META_API_KEY=... META_API_BASE_URL=https://api.meta.ai/v1
```

On Windows PowerShell that is:

```powershell
$env:META_API_KEY="..." ; $env:META_API_BASE_URL="https://api.meta.ai/v1"
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
| `apps/portal/` | The Charie workspace UI. |
| `deploy/` | Dockerfiles for the three Cloud Run services. |
| `docs/` | Architecture, demo script, Meta stack mapping, Firestore schema, roadmap. |
| `AGENTS.md` | Working notes for AI coding sessions on this repo. |

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system design, agent roles, data flow
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) - the 3-minute judging demo, beat by beat
- [docs/META_STACK.md](docs/META_STACK.md) - every Meta model/API and where it is used
- [docs/FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md) - database collections
- [docs/ROADMAP.md](docs/ROADMAP.md) - what is deliberately *not* in the hackathon build
  and why

## Scope honesty

The build monitors **your real production**: log watch reads your GCP project's
live errors, prod web apps report through the drop-in SDK, and mobile apps plug
into the same pipeline via the documented contract (`docs/MOBILE_SDK.md`, native
wrappers next). Investigation runs drive real web apps (the demo target for
judges; any URL you file). Meet rooms use mesh P2P with STUN (no TURN relay
yet). All security checks are safe and authorized: no destructive payloads, no
third-party targets. No remote control, no "certified secure" claims. Full
rationale in `docs/ROADMAP.md`.

## Built with Meta

Every line of this repo was written with [Muse Code by Meta](https://dev.meta.ai/lp/muse-code),
the AI coding agent powered by Meta Muse Spark - look for the `Built-with` trailer in
the commit history. The product runs on Meta Model API models (Spark, Wonder, Image,
Voice Transcribe, SAM 3.1), open-weight Muse Glimmer and Muse Spark Open, with
Muse Code as the coding agent that consumes our MCP fix packets. Full mapping in
[docs/META_STACK.md](docs/META_STACK.md).
