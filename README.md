# GhostQA — the AI that circles back with proof

[![Built with Muse Code](https://img.shields.io/badge/Built%20with-Muse%20Code-0668E1?logo=meta)](https://dev.meta.ai/lp/muse-code)

**One agent. Three perspectives. A closed loop from customer problem to verified fix.**

GhostQA (repo: `circle-back`) is an autonomous product-quality engineer built for the
Meta Global AI Developer Hackathon 2026. It investigates a real app like a combination of
a software engineer, a security tester, a usability researcher, and a first-time user —
then proves the fix worked by re-running the same journey.

## The core loop (the whole product in 6 steps)

1. **Ticket in** — a customer problem arrives ("checkout button does nothing").
2. **Investigate** — the agent reproduces it in the real app: functional run,
   first-time-user simulation, accessibility and safe security checks.
3. **Room** — evidence (screenshots, repro steps, logs, diagnosis) lands in a shared
   issue room where the team discusses and approves one instruction.
4. **Fix** — the approved instruction goes to the team's coding agent (via MCP) or a
   manual patch.
5. **Verify** — GhostQA re-runs the exact same journey and diffs before/after.
6. **Circle back** — the ticket gets a resolution package: what broke, what changed,
   proof it works now.

> A system that only produces insightful reports is another analysis tool.
> A system that finds a problem, helps fix it, and independently verifies the
> improvement demonstrates an autonomous engineering workflow. That's the demo.

## Why this wins (honest version)

- **Real buyer, real money:** small SaaS teams pay to kill the support↔engineering
  translation tax. Every ticket today burns support time + engineering repro time.
- **Signature feature:** AI usability simulation — testing whether a first-time user can
  *figure out* the app, not just whether buttons work. Separate, clearly-labeled
  from human validation (we never claim the sim *is* a human).
- **Deep Meta stack:** Muse Spark (reasoning agents), Muse Image (UI redesigns),
  Llama open weights (fast/cheap subtasks), SAM (screenshot grounding),
  Muse Code (receives our MCP fix instructions). See [docs/META_STACK.md](docs/META_STACK.md).
- **Demoable in 6 days:** one app, one task, one verified improvement.
  See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Repo map

| Path | What it is |
|---|---|
| `apps/demo-target/` | ShopFast: intentionally buggy demo store (seeded bug + confusing journey). The thing we test. Run it first. |
| `services/agent-engine/` | The autonomous loop: explore → simulate user → analyze → report → verify. TypeScript + Playwright + Meta Model API. |
| `services/mcp-server/` | MCP adapter: lets any coding agent pull findings + push fixes back for verification. |
| `apps/portal/` | Issue rooms UI: tickets, evidence, discussion, approvals, run/verify triggers. |
| `docs/` | Architecture, demo script, Meta stack mapping, Firestore schema, roadmap. |

## Quickstart (5 minutes, no API keys)

```bash
# 1. Start the buggy demo app
npm install --workspace apps/demo-target
npm run demo:target
# → http://localhost:3101

# 2. In another terminal, run the autonomous loop (mock analysis mode)
npm install --workspace services/agent-engine
npm exec --workspace services/agent-engine -- playwright install chromium
npm run agent:run
# → ./reports/<timestamp>/report.md + screenshots + findings.json
```

With Meta Model API access (hackathon credits), store the keys in GCP Secret
Manager (secret IDs in [docs/META_STACK.md](docs/META_STACK.md)), set
`GCP_PROJECT_ID`, and authenticate once via `gcloud auth application-default
login` — the same command then upgrades from heuristic analysis to Muse
Spark-powered diagnosis + Muse Image redesigns. No `.env` file involved.

```bash
# 3. Or drive the whole loop from the portal (tickets → rooms → evidence)
npm install --workspace apps/portal
npm run portal:dev
# → http://localhost:3102 (needs the demo-target from step 1 running too)
```

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, agent roles, data flow
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) — the 5-minute judging demo, beat by beat
- [docs/META_STACK.md](docs/META_STACK.md) — every Meta model/API and where it's used
- [docs/FIRESTORE_SCHEMA.md](docs/FIRESTORE_SCHEMA.md) — database collections
- [docs/ROADMAP.md](docs/ROADMAP.md) — what's deliberately *not* in the hackathon build
  (Zoom agent, pentest, crypto review, mobile) and why

## Scope honesty

The hackathon build covers **web apps only**, one demo target, simulated (not live)
support ingestion, and safe, authorized checks only. No remote control, no "certified
secure" claims, no custom video service. Full rationale in `docs/ROADMAP.md`.

## Built with Meta

Every line of this repo was written with [Muse Code by Meta](https://dev.meta.ai/lp/muse-code),
the AI coding agent powered by Meta Muse Spark — look for the `Built-with` trailer in
the commit history. The product itself runs on eight Meta technologies: Muse Spark,
Muse Wonder, Muse Image, Muse Voice Transcribe and SAM 3.1 via the Meta Model API,
open-weight Muse Glimmer and Muse Spark Open, with Muse Code as the coding agent that
consumes our MCP fix packets. Full mapping in [docs/META_STACK.md](docs/META_STACK.md).
