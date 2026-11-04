# No more screenshots. No more back-and-forth. Charie joins the call, sees the screen, and fixes it live - then guards your product all night.

[![Built with Muse Code](https://img.shields.io/badge/Built%20with-Muse%20Code-0668E1?logo=meta)](https://dev.meta.ai/lp/muse-code)

**Stop sending screenshots to an AI chat and waiting for it to guess.** Charie joins the call with you, sees the customer's screen, analyses what is actually there, tells them what to try, watches the result, checks the error, debugs the next step, and guides them step by step - all inside the same call. No describing screens out loud. No screenshot ping-pong. No ticket written from memory afterwards. When a real fix is needed, she turns the call into a ticket, an investigation, and a verified fix, with a human approving every consequential step - then she stays awake all night watching for the next attack.

**What Charie is, in the plain words:** an **AI support engineer** for your customers, **autonomous engineering intelligence** for your team, and your **standby on-call AI agent** for the night. Three jobs, one agent, one workspace.

**Vision:** a world where no customer ever has to describe a screen over the phone, no solo developer ever wakes up to an attack that ran for six hours, and no bug is called "fixed" until software itself has proved it.

Live product: https://charie-portal-ehfuotlisq-uc.a.run.app (Google or email sign-in)

Full engineering detail: [docs/TECHNICAL.md](docs/TECHNICAL.md). Meta model map: [docs/META_STACK.md](docs/META_STACK.md). Three-minute demo: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

---

## The story this was built from

Charie was built by a solo developer with 4.5 years in customer-facing solutions and support roles.

On support calls the same ritual repeats every day. The customer says "it shows an error". The agent says "can you read it to me". Then come screenshots sent to an AI chat one at a time, "wait, that is the old screen, let me send a new one", screen-share links that expire, "click the blue button - no, the other blue button", and a ticket written from memory after the call. Every screenshot is a frozen guess: by the time the AI answers, the screen has already changed. The person who could actually see the screen is never the person on the call.

Charie eliminates that entire loop. She does not need screenshots taken, uploaded, described, or explained. She joins the call herself, looks at the live shared screen, analyses it, tells the customer exactly what to try next, sees the result of that step on the next frame, checks whatever error appears, and keeps guiding - try this, did it work, try that - until the issue is solved on the call or has become a properly evidenced ticket with the investigation already started.

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

## Real autonomy: the agent loops (not one-shot prompts)

Yes, the autonomy is real - and it is bounded on purpose, because businesses cannot ship an agent that acts without guardrails. Charie runs closed agent loops, each with an observe - decide - act - verify cycle:

| Agent loop | How it runs on its own | Human guardrail |
|---|---|---|
| Live call loop | Hears you, captures a fresh screen frame, analyses, answers, tells the customer what to try, then looks again at the result and debugs the next error - repeating until solved or escalated | She never takes remote control; consequential actions appear as consent cards |
| Watch loop | Samples the shared screen every few seconds, sends only changed frames, speaks only when something real breaks (never the same thing twice) | Host turns looking on; she stops talking the moment a human speaks |
| Investigation loop | A ticket starts a Playwright run on its own: explores like a first-time user, collects evidence, grades findings, gets a second model opinion, writes repro and fix packets | A human approves the fix instruction before anything is dispatched |
| Verification loop | After a fix, re-runs the exact journey that failed and diffs before/after; regressions reopen instead of passing quietly | Proof is shown to the team; Charie cannot mark her own work done without the re-run |
| Guard and night-shift loop | Log watch, SDK signals, hourly sweeps, and the security suite feed deterministic detectors; incidents are triaged, challenged by a second model, and approved fix tasks execute overnight with a morning digest | Only approved or scheduled work orders run at night; verdict disagreements flag a human |
| Repo loop | A push rebuilds, deploys, retests, posts status back to the commit, and can file its own ticket | Repo connection and scopes are granted by the account owner |

This is the honest definition used everywhere in the product: **autonomous within approved scope, supervised where it matters.** Charie starts investigations, watching, sweeps, and night work without being poked; she stops and asks before she changes anything that matters.

## Built on Meta Muse intelligence (the core technical features)

- **Muse Spark Open on Baseten (`meta-models/muse-spark-open-1026`)** is the default Chat and Meet brain: a tool-using agent loop (maximum 5 tool turns, every action receipted) that files tickets, runs scans, reads findings, and checks builds - and independently re-grades findings as a second opinion and challenges Guard verdicts.
- **Muse Spark `muse-spark-1.3` (Meta Model API, direct)** powers investigation reasoning and cause/fix prose, incident analysis, and is the first lane that sees your screen in Meet; it is also the Meta lane a user can pick in Chat.
- **Muse Wonder `muse-wonder-1.0`** takes the hard cases: deep-dive root cause for low-confidence findings and blocker incident planning.
- **Muse Image `muse-image-1.0`** turns usability findings into generated redesign screens a team can approve.
- **SAM 3.1 `sam-3-1`** grounds failure screenshots in named UI regions, so evidence points at the actual control.
- **Muse Voice Transcribe `muse-voice-transcribe-1.0`** turns spoken bug reports into structured tickets; **Muse Glimmer** (open weights) does fast ticket triage and Guard noise filtering.
- **Muse Code** built this repo and, at runtime, consumes Charie's MCP fix packets and must check verification proof before calling a fix done.
- Voice and hearing stay honest: speaking is Kokoro on Modal (not a Meta model), live-call hearing is the browser recognizer. Full lane-by-lane detail: [docs/TECHNICAL.md](docs/TECHNICAL.md).

## Why this is a real B2B business, not a demo

- **Who buys it:** SaaS support and solutions teams drowning in "can you send a screenshot" calls; small product teams with no night coverage; solo builders who are their own on-call. One workspace replaces a meeting bot, a QA runner, a pentest scanner, a monitoring pager, and half the ticket busywork - with proof attached for compliance-minded buyers.
- **Why they stay:** every call, investigation, incident, and fix becomes account-scoped evidence history. Switching away means losing the audit trail.
- **How it deploys:** hosted Cloud Run workspace with per-account data isolation, team seats, app keys, Google sign-in, GitHub and Jira sync, and a zero-key trial path - the same patterns businesses already buy.
- **Why it is safe to buy:** autonomy is guardrailed (approvals, consent cards, labelled heuristic fallbacks, no remote control, no call recording), so a business can adopt it without handing an agent the keys.

## The wow moments

1. **She joins the call and actually sees - so screenshots die here.** Open a Meet room, send the guest link to a customer (no account needed on their side, consent first), share a screen, and ask out loud: "Charie, what is wrong here?" Nobody takes a screenshot, uploads anything, or describes the screen. She captures a fresh frame herself, analyses it, answers in one short spoken sentence, tells the customer what to click or try, then looks again: did it work, what error appeared, what is the next step. That see - guide - see the result - debug loop repeats live until it is fixed in the call, and her timestamped screen memory means "what did it show two minutes ago?" also has a real answer.
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
| Support copilot / AI chat with screenshots | You take and send a screenshot in chat, describe it, wait, then send the next one; it guesses from frozen images and the back-and-forth never ends | No screenshots at all: Charie is on the call, sees the live screen, guides step by step, watches each result, and debugs the error that appears next |
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

## Demo Mode (no login, sample data, real AI)

On the login page, press **Explore Charie Demo - no login needed**. No account, no email, no OAuth, no keys to configure. You land in a seeded Demo Workspace (a banner says so on every page) with three sample projects - Demo Site, TravelMate, WorkBoard - 8 tickets, 4 investigation runs whose reports open with findings, 2 labelled simulated Guard incidents, a simulated GitHub repo (`circle-back/demo-site`, builds labelled simulated), autopilot schedules, and a sample Meet call Charie assisted. Everything is internally consistent: the runs belong to the tickets, the reports belong to the runs, and another account cannot see any of it.

- **Try everything:** file tickets, approve, chat, open reports, explore Guard, start a Meet room. Against the local demo site (http://localhost:3101) investigations run for real with Playwright.
- **Your progress is saved** in the same store as real data (local files on your machine, Firestore on the hosted demo) under the demo account only. **Reset Demo Workspace** in the banner restores the seed and removes only demo changes - never real user data.
- **Simulated vs live is labelled:** sample builds and incidents say "simulated"; seeded findings say SAMPLE DEMO DATA. Nothing simulated is presented as a live result.

**About AI in Demo Mode - the honest version.** Demo Mode never fakes AI. Live AI actions (Chat answers, investigation analysis, test plans, call vision) call the real models: Baseten Muse Spark Open first for chat, Meta Muse Spark 1.3 direct, the lanes in the model table below. Those calls need a key on the host that runs the engine:

- **Hosted demo (the live URL above):** the engine runs with the owner's Secret Manager keys mounted, so judges get real Meta model answers without configuring anything.
- **Your own machine:** set `META_API_KEY` and/or `BASETEN_API_KEY` as environment variables, or sign in with `gcloud auth application-default login` plus `GCP_PROJECT_ID` and the engine reads your Secret Manager secrets itself (env wins first, then Secret Manager - there is no `.env` file).
- **A judge's machine with no keys:** the sample workspace still opens and browses fully, but AI answers say plainly that no live model is configured instead of inventing one. We will not ship the owner's private API keys inside a public repo - that would leak them - and we will not pretend a heuristic is a Meta model.

## Judges: two ways to evaluate (pick either)

**Path A - hosted demo, zero setup.** Open https://charie-portal-ehfuotlisq-uc.a.run.app, press **Explore Charie Demo - no login needed** on the login page. Sample projects, runs, reports, and simulated integrations load immediately, and AI answers are powered by the host's configured Meta models. No account, no key, nothing to install.

**Path B - run it yourself, with your own Meta key.** This is the reproducible path:

1. Clone this repo and install: `npm install` (Node.js 20+). Install the browser once: `npm exec --workspace services/agent-engine -- playwright install chromium`.
2. Get your own Meta Model API key at https://dev.meta.ai (Model API). It is free to create; usage is billed to *your* key. Never use anyone else's key, and never commit yours - this repo intentionally has no `.env` loader, and `.env` is gitignored.
3. Set the key in your shell before starting the engine. Windows PowerShell:

```powershell
$env:META_API_KEY="your key"
$env:ENGINE_DEV_OPEN="1"
```

Linux / macOS:

```bash
export META_API_KEY="your key"
export ENGINE_DEV_OPEN=1
```

Optional: `BASETEN_API_KEY` (Muse Spark Open brain), `CHARIE_TTS_URL` (Modal voice). Full list with placeholders: [.env.example](.env.example).

4. There is no database to initialize locally: the portal creates its JSON file store on first run, and Demo Mode seeds itself the first time you enter it. (Hosted mode uses Firestore - see [docs/TECHNICAL.md](docs/TECHNICAL.md).)
5. Start the three processes and follow the Five-minute judge tour below: `npm run demo:target`, `npm run serve --workspace services/agent-engine`, `npm run portal:dev`, then http://localhost:3102.
6. Tests any time: `npm test` (offline-safe, no keys needed).

Submission readiness evidence (secret scan results, checklist): [docs/SUBMISSION_AUDIT.md](docs/SUBMISSION_AUDIT.md). Recorded-demo provenance pack: [docs/DEMO_PROVENANCE.md](docs/DEMO_PROVENANCE.md).

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
| Muse Spark `muse-spark-1.3` (Meta Model API, direct) | Investigation reasoning, finding cause/fix prose, incident analysis, live screen vision (first lane), and Chat/Meet only when Meta lane is picked or Baseten is unavailable |
| Muse Wonder `muse-wonder-1.0` | Deep-dive escalation for hard or low-confidence findings and blocker incidents |
| Muse Image `muse-image-1.0` | Screen redesigns generated from usability findings |
| Muse Voice Transcribe `muse-voice-transcribe-1.0` | Spoken bug reports turned into structured tickets |
| SAM 3.1 `sam-3-1` | Grounding boxes on failure screenshots, shown as "Grounded by SAM 3.1" |
| Muse Spark Open `meta-models/muse-spark-open-1026` (open weights, hosted on Baseten - a different model from `muse-spark-1.3`) | Default Chat and Meet brain in Auto mode, independent second opinion that re-grades findings, adversarial check on Guard verdicts, second vision lane |
| Muse Glimmer (open weights, Ollama by default) | Fast ticket triage: goal extraction, severity pre-grade, dedup |
| Kokoro-82M on Modal (not a Meta model) | Charie's warm spoken voice in calls, one always-warm container |
| Muse Code | Built this repo, and at runtime consumes MCP fix packets |

**Which model actually answers you in Chat and Meet (read this carefully):**

- Thinking and replying (the brain): Chat and Meet share one agent loop. In Auto (the default, and the only mode inside a Meet call) it calls **Baseten first: Muse Spark Open `meta-models/muse-spark-open-1026`**. That is an open-weight model served by Baseten - it is **not** `muse-spark-1.3`. If Baseten is missing or fails, it falls back to **Meta Model API directly: Muse Spark `muse-spark-1.3`**, then to the built-in heuristic (labelled). In Chat you can force Baseten, Meta, or Heuristic with the model pill; every reply labels which lane answered.
- Seeing the screen (vision): the order flips. **Meta Muse Spark `muse-spark-1.3` direct first**, Baseten Muse Spark Open second.
- Speaking (voice out): **not a Meta model and not Baseten.** Charie's voice is Kokoro-82M hosted on **Modal** (`CHARIE_TTS_URL`), falling back to the browser voice.
- Hearing (voice in): the browser Web Speech API in calls. **Muse Voice Transcribe `muse-voice-transcribe-1.0`** is used only for voice bug-report tickets, not live-call listening.

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
- **Problem statement:** Build for Your World - AI built for the world of support engineers and solo builders: an agent that joins their customer calls, sees the screen, investigates, verifies, schedules, and syncs fixes across GitHub and Jira with humans approving consequential steps.
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
- [docs/SUBMISSION_AUDIT.md](docs/SUBMISSION_AUDIT.md) - secret scan results and the final submission checklist
- [docs/DEMO_PROVENANCE.md](docs/DEMO_PROVENANCE.md) - provenance pack for the recorded demo
- [.env.example](.env.example) - every configuration variable, placeholders only

*Every line of this repo was written with Muse Code by Meta.*
