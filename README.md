# Charie - the AI support engineer who joins the call, sees the screen, fixes the problem, then works the night shift

[![Built with Muse Code](https://img.shields.io/badge/Built%20with-Muse%20Code-0668E1?logo=meta)](https://dev.meta.ai/lp/muse-code)

**One line:** Charie joins your customer call, sees the customer's screen, solves the problem live, turns it into a verified fix, and then watches your production all night for the next one.

**Vision:** a world where no customer ever has to describe a screen over the phone, no solo developer ever wakes up to an attack that ran for six hours, and no bug is called "fixed" until software itself has proved it.

Live product: https://charie-portal-ehfuotlisq-uc.a.run.app (Google or email sign-in)

Full engineering detail: [docs/TECHNICAL.md](docs/TECHNICAL.md). Meta model map: [docs/META_STACK.md](docs/META_STACK.md). Three-minute demo: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

---

## The story this was built from

Charie was built by a solo developer with 4.5 years in customer-facing solutions and support roles.

On support calls the same ritual repeats every day. The customer says "it shows an error". The agent says "can you read it to me". Then come screenshots over email, screen-share links that expire, "click the blue button - no, the other blue button", and a ticket written from memory after the call. The person who could actually see the screen is never the person on the call.

The second pain is the night. A solo developer ships in the evening, sleeps, and finds in the morning that an attack, a broken checkout, or a flood of errors ran for hours with nobody watching. Big companies buy a night shift. Solo builders and small teams cannot.

The third pain is trust. Tools report "fixed" and nobody re-runs the journey that failed. UX advice arrives as paragraphs nobody can picture.

Charie is the teammate wished for in all three moments: present on the call, awake at night, and stubborn about proof.

## What Charie is

Charie is one autonomous engineering teammate shipped as three products on one spine: **ticket -> evidence -> fix -> proof**.

| Product | Promise | Main surfaces |
|---|---|---|
| Charie Build | Find it, fix it, prove it before release | Home, Tickets, Test a repo, UX and redesign, Accessibility, First run, Reports |
| Charie Guard | Answer threats while you sleep | Threats, Fix tasks, Security tests, Night shift, Autopilot |
| Charie Ops | Production that files its own tickets, and a support engineer on the call | Live signals, Meet, Chat, Repos, Marketplace |

Charie is not a chatbot bolted onto a dashboard. The same agent brain runs in Chat, inside Meet calls, in investigations, and in the night shift. Every consequential action waits for a human approval. Every claim of success needs a re-run.

## The wow moments

1. **She joins the call and actually sees.** Open a Meet room, send the guest link to a customer (no account needed on their side, consent first), share a screen, and ask out loud: "Charie, what is wrong here?" She captures a fresh frame of the shared screen, answers in one short spoken sentence, and keeps a timestamped memory of what the screen showed, so "what did it show two minutes ago?" has a real answer.
2. **She watches like a person, not a poller.** In watch mode the browser samples the shared screen locally, compares pixels, and only sends changed frames. She stays silent unless something real breaks, never repeats the same observation, and stops talking the moment a human starts speaking.
3. **A bug becomes proof, not opinion.** File a ticket and Charie drives the real app with Playwright like a first-time user, records screenshots, repro steps, console and network evidence, proposes a fix, and after your approval re-runs the exact same journey and diffs before and after.
4. **The night shift is real work, not a cron label.** Threats from log watch, the drop-in SDK, sweeps, and a security test suite become triaged incidents. Approved fix tasks execute overnight and the morning digest shows what ran, what passed, and what still needs a human.
5. **UX advice you can see.** Usability findings come back as generated screen redesigns with trade-offs, not paragraphs. Accessibility returns a grade. First run returns a new-user score.
6. **Your coding agent is a coworker, not a rival.** Through MCP (cloud endpoint on the portal or a local stdio server), Muse Code and other agents pull findings and fix packets, and must check verification proof before calling anything done.
7. **It works with zero keys.** A judge can clone this repo, run three commands, and exercise the whole loop with no API key at all. Live Meta models upgrade the prose, vision, voice, and redesigns when keys are present. Anything not live is labelled honestly in the product itself.

## Why this is different from the tools you already know

| The usual tool | What it stops at | What Charie adds |
|---|---|---|
| Meeting bot | Records and transcribes | Joins live, sees the shared screen, answers during the call, proposes actions as consent cards |
| Test runner | Pass or fail on scripts you wrote | Explores like a first-time user, writes the repro, proposes the fix, verifies the fix |
| Pentest scanner | A PDF of findings | Triaged incidents, approved fix tasks, re-tests, morning digest |
| Support copilot | Suggests text to the agent | Sees what the customer sees and guides the click, on the call |
| Monitoring alert | Wakes you up | Investigates first, challenges its own verdict with a second model, brings you a plan |

Pieces of this exist separately (screen-sharing support tools, meeting assistants, AI pentesters, agent builders). The closed loop - call, see, investigate, fix, verify, guard overnight - in one account-scoped workspace is the product.

## Five-minute judge tour (local, no keys)

Prerequisites: Node.js 20+ and npm. From the repo root:

```bash
npm install
npm run demo:target
npm exec --workspace services/agent-engine -- playwright install chromium
$env:ENGINE_DEV_OPEN="1"; npm run serve --workspace services/agent-engine
npm run portal:dev
```

Open http://localhost:3102 and press **Continue as local owner**. Then:

1. File the ticket `Checkout button does nothing` against `http://localhost:3101`. An investigation starts; expect 6 seeded findings with screenshots and repro steps (blocker checkout failure, usability, accessibility, security surface).
2. Approve a fix instruction, restart the demo with `npm run dev:fixed --workspace apps/demo-target`, press **Verify fix**, and read the before/after proof.
3. Open **UX and redesign**, **Accessibility**, and **First run** for the graded views of the same evidence.
4. Open **Threats**, press **Simulate attack**, then **Analyze now**, approve a response, and run **Night shift** to see autonomous execution with a digest.
5. Open **Meet**, start a room, join from a second browser tab as a guest, share a screen, turn on **Charie can look**, and ask what she sees.
6. Open any report and press **Ask Charie about this report** to continue in Chat with the report attached.
7. Open **Reports** to see every run, scan, pentest, and digest in one place with working timeframe filters.

Zero keys changes only polish, and the UI says so: finding prose is labelled `heuristic`, chat uses the heuristic router, call voice uses the browser voice, and screen vision, image redesigns, and voice transcription wait for keys. Nothing hard-fails. Full detail in [docs/TECHNICAL.md](docs/TECHNICAL.md).

## How it works, in one picture

```text
Customer / teammate / production signal
  |            |                 |
  v            v                 v
 Meet call   Ticket           Guard event
 (sees screen, (Playwright     (log watch, SDK,
  speaks, notes) investigation)  sweep, pentest)
  |            |                 |
  +------> Issue room <----------+
           evidence, approvals,
           fix packets (MCP)
                  |
                  v
              Verifier re-runs
              the same journey
                  |
                  v
        Proof, report, digest,
        ticket closed with evidence
```

The portal (`apps/portal`, Next.js) owns identity, rooms, approvals, and reports. The engine (`services/agent-engine`, Playwright plus Meta models) does the driving, seeing, and reasoning. The demo target (`apps/demo-target`) is the intentionally buggy store the loop is proven against. Modal hosts the warm Kokoro voice. Firestore or local JSON files store everything per account. The complete component, API, data, and model reference is [docs/TECHNICAL.md](docs/TECHNICAL.md).

## Meta models, honestly

A model counts as used only when a real request succeeds. Every surface degrades to a labelled heuristic instead of failing.

| Model | Where Charie uses it |
|---|---|
| Muse Spark `muse-spark-1.3` | Investigation reasoning, finding cause/fix prose, Chat and Meet agent brain, incident analysis, live screen vision (first lane) |
| Muse Wonder `muse-wonder-1.0` | Deep-dive escalation for hard or low-confidence findings and blocker incidents |
| Muse Image `muse-image-1.0` | Screen redesigns generated from usability findings |
| Muse Voice Transcribe `muse-voice-transcribe-1.0` | Spoken bug reports turned into structured tickets |
| SAM 3.1 `sam-3-1` | Grounding boxes on failure screenshots, shown as "Grounded by SAM 3.1" |
| Muse Spark Open `meta-models/muse-spark-open-1026` (Baseten) | Independent second opinion that re-grades findings, adversarial check on Guard verdicts, second vision lane |
| Muse Glimmer (open weights, Ollama by default) | Fast ticket triage: goal extraction, severity pre-grade, dedup |
| Kokoro-82M on Modal (not a Meta model) | Charie's warm spoken voice in calls, one always-warm container |
| Muse Code | Built this repo, and at runtime consumes MCP fix packets |

File-by-file mapping, secret names, and fallbacks: [docs/META_STACK.md](docs/META_STACK.md) and [docs/TECHNICAL.md](docs/TECHNICAL.md).

## Product tour

- **Home:** real-data analytics (activity, outcomes, severity) with hover values, a compact side checklist, priority queue.
- **Chat:** a tool-using operator with receipts for every action, compact model and effort controls, report-aware conversations.
- **Tickets and rooms:** evidence, approvals, fix dispatch, verification, per-account history.
- **Meet:** mesh WebRTC rooms, guest links with consent, live transcript, Charie panel before the transcript, screen watch with timestamped memory, rooms that reopen with their history.
- **Guard:** threats, incidents, fix tasks, security tests, night shift, autopilot schedules, push alerts.
- **Build quality:** UX redesigns, accessibility grades, first-run scores, connected GitHub repos that build, deploy, and report back.
- **Reports:** every investigation, scan, pentest, verification, and digest, verdict first, with Ask Charie attached.
- **Marketplace and Integrations:** Jira and GitHub sync, MCP configs for coding agents, drop-in web SDK, documented mobile contract.

## Scope honesty

Charie monitors your real production through GCP log watch, the web SDK, and the mobile contract. Investigations drive real web apps you scope. Meet uses mesh peer-to-peer with STUN (no TURN relay yet, so strict NATs can fail). Security checks are safe and authorized only: no destructive payloads, no third-party targets, no remote control of customer machines, no "certified secure" claims. Calls are never recorded; live notes and transcript save only with consent. The roadmap and deliberate omissions are in [docs/ROADMAP.md](docs/ROADMAP.md).

## Run, test, deploy

Tests: `npm test` runs the engine suites (regression, server, guardian-plus, access, chat-agent, vision), the MCP smoke test, and the portal suite. Typecheck: `npm run typecheck --workspace services/agent-engine` and `npm run typecheck --workspace apps/portal`. Production build: `npm run portal:build`.

Production runs on one Google Cloud project: Cloud Run services `charie-portal`, `charie-engine`, and `charie-demo`, Firestore for data, Cloud Storage for artifacts, Secret Manager for keys (no `.env` file exists by design), Artifact Registry plus Cloud Build for images, and CI deploy on push to `dev` through Workload Identity Federation. Voice deploys separately with `modal deploy services/modal-tts/modal_app.py`. Detail: [docs/TECHNICAL.md](docs/TECHNICAL.md) and [AGENTS.md](AGENTS.md).

## Hackathon submission

- **Track:** Indie Developer (solo build).
- **Problem statement:** Push the Frontier - AI autonomy in software engineering and support: an agent that sees, investigates, verifies, schedules, and syncs fixes across GitHub and Jira with humans approving consequential steps.
- **New work:** everything in this repo was built during the hackathon. Nothing predates it.
- **Built with:** Muse Code by Meta. Look for the `Built-with: Muse Code by Meta` trailer in the commit history.

## Docs

- [docs/TECHNICAL.md](docs/TECHNICAL.md) - every feature, flow, API, model, data store, and limitation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system design and agent roles
- [docs/META_STACK.md](docs/META_STACK.md) - Meta model mapping and secrets
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) - the three-minute demo, beat by beat
- [docs/FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md) - collections and records
- [docs/MOBILE_SDK.md](docs/MOBILE_SDK.md) - production signal contract for mobile apps
- [docs/ROADMAP.md](docs/ROADMAP.md) - what is deliberately not in this build, and why

*Every line of this repo was written with Muse Code by Meta.*
