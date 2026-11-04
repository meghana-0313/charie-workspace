# Charie - complete technical reference

Charie - AI support agent on the call, autonomous engineering on the loop, on standby all night. Autonomous agent loops for support, QA, and security - on call around the clock, supervised where it counts.

This document explains what Charie is made of, how every feature works end to end, which model does what and where, what happens when a key or service is missing, and what the system deliberately does not do. It is written for hackathon judges, engineers reviewing the code, and businesses evaluating the product.

Companion docs: [README.md](../README.md) for the story, [META_STACK.md](META_STACK.md) for the short model map, [ARCHITECTURE.md](ARCHITECTURE.md) for design principles, [FIRESTORE_SCHEMA.md](FIRESTORE_SCHEMA.md) for collections.

## Contents

1. Product definition and design rules
2. System architecture
3. Repository map
4. Identity, accounts, and sessions
5. The core spine: ticket, evidence, fix, proof
6. Investigation engine (Playwright loop)
7. Chat agent (the operator brain)
8. Meet: live calls with Charie inside
9. Screen vision and continuous watch
10. Voice: speech in, speech out
11. Charie Guard: threats, incidents, night shift
12. Security tests (pentest suite)
13. Accessibility and first-run scoring
14. UX analysis and generated redesigns
15. Reports and Ask Charie
16. Home analytics and checklist
17. Repos, builds, and GitHub sync
18. Marketplace, connectors, and MCP for coding agents
19. Production signals: log watch, web SDK, mobile contract
20. Autopilot, schedules, cron, and push alerts
21. Meta models: exact usage, files, prompts, fallbacks
22. Non-Meta services: Modal voice, Baseten, Firebase, Google Cloud
23. Data model and storage
24. HTTP API reference (portal and engine)
25. Security model
26. Configuration and secrets
27. Local development and the zero-key judge path
28. Testing and verification
29. Deployment and CI
30. Performance and latency engineering
31. Honesty rules and known limitations
32. Judging criteria map
33. Glossary
34. Demo Mode (no-login sample workspace)

## 1. Product definition and design rules

Charie is an autonomous engineering teammate for support, quality, and production reliability. One-line definition: Charie joins your customer call, sees the customer's screen, solves the problem live, turns it into a verified fix, and then watches your production all night for the next one.

Three products share one workspace and one agent brain:

- Charie Build: QA, testing, debugging, UX, accessibility, first-run quality.
- Charie Guard: runtime security, threat triage, incident response, night shift.
- Charie Ops: production signals, live support calls (Meet), repos, and operations.

Design rules enforced in code, not just copy:

1. Evidence over assertions. No finding exists without screenshots, repro steps, and logs.
2. Verify, do not trust. A fix is only "fixed" when the identical journey is re-run and passes with no regression in scope.
3. Humans approve consequences. Investigations, responses, and fix tasks can be proposed by Charie; running them needs an explicit human approval in the UI.
4. Honest labels. `analysisSource` is `heuristic` until a real model call succeeds. A surface that is off says it is off and why.
5. Fail soft on cloud. Missing project, credentials, secrets, or model endpoints degrade to heuristic or file-backed behavior. Nothing hard-crashes for lack of a key.
6. Per-account isolation. Every ticket, room, run, and Guardian partition is scoped by account id (`uid`). One account never reads another account's data.
7. No secret files. There is no `.env` file by design. Secrets resolve environment first, then Google Cloud Secret Manager.
8. Calls are not recordings. Meet audio and video are never recorded. Live notes and transcript are saved only when participants opt in.

Autonomy model - real, bounded, and auditable:

Charie is described in product language as an AI support engineer (customer-facing job), autonomous engineering intelligence (platform category), and a standby on-call AI agent (night job). The autonomy behind those words is a set of closed agent loops, each running observe - decide - act - verify without a human prompting every step, and each stopping for approval before side effects that matter:

| Loop | Observe | Decide | Act | Verify | Code |
|---|---|---|---|---|---|
| Chat and Meet tool loop | Conversation, transcript, account context | Model picks a tool or a text answer | Tool executes (file, scan, read, check); side-effect tools become consent cards | Tool result is fed back for up to 5 turns; every action receipted | `apps/portal/lib/charie-chat.ts` (loop, `needsConsent`), `services/agent-engine/src/chat-agent.ts`, `apps/portal/lib/call-agent.ts` |
| Investigation and verification loop | Playwright trace, screenshots, console and network | Heuristic grading, Spark enrichment, Wonder escalation, Spark Open second opinion | Report, repro, fix packets; fix dispatched after approval | Identical journey re-run, before/after diff, regressions reopen | `src/explorer.ts`, `src/analyst.ts`, `src/wonder.ts`, `src/baseten.ts`, `src/verifier.ts`, `src/job.ts` |
| Live call and watch loop | Speech, fresh screen frames, changed-frame sampler | Screen question and history detection, vision model answer | Speaks one short step, guides the customer, looks again at the result | New frame confirms or contradicts the step; timestamped screen log is the record | `apps/portal/components/meet.tsx`, `src/vision.ts`, `apps/portal/lib/livecall.ts`, `apps/portal/lib/room-status.ts` |
| Guard and night-shift loop | Logs, SDK signals, hourly sweeps, pentest results | Deterministic detectors, Glimmer pre-filter, Spark verdict, Spark Open adversarial challenge | Approved responses and work orders execute; push alerts on blockers | Containment and fix verification; morning digest built only from executed records | `src/guardian.ts`, `src/nightshift.ts`, `src/sweep.ts`, `src/logwatch.ts`, `src/workorders.ts` |
| Repo loop | GitHub push webhook | Build and test outcome | Deploy, status back to commit, self-filed ticket on failure | Re-test on the next push closes or reopens the ticket | `apps/portal/lib/github.ts`, `apps/portal/lib/gcp.ts`, `/api/github/webhook` |

Core technical features built on Meta Muse intelligence are mapped lane by lane in section 21: Spark Open (Baseten) as the default tool-using brain and adversarial second opinion, Spark 1.3 direct for investigation prose and first-lane screen vision, Wonder for deep dives, Image for redesigns, SAM 3.1 for grounding, Voice Transcribe for voice tickets, Glimmer for triage, and Muse Code consuming MCP fix packets with a proof check. Cartesia Sonic voice (Kokoro on Modal as fallback) and browser speech recognition are deliberately not labelled as Meta intelligence.

## 2. System architecture

```text
Browser (portal, Next.js)
  |  HTTPS, HMAC session cookie
  v
Portal (Cloud Run: charie-portal, port 3102 local)
  |  server-side calls with ENGINE_TOKEN
  v
Agent engine (Cloud Run: charie-engine, port 3103 local)
  |  Playwright Chromium drives target apps
  |  Meta Model API / Baseten / Ollama model calls
  v
Reports on disk or GCS, findings, verification diffs

Meet media: browser to browser mesh WebRTC (STUN only)
Meet signaling, live notes, screen frames, TTS: portal APIs
Charie voice synthesis: Cartesia Sonic (CARTESIA_API_KEY, portal) -> Modal Kokoro endpoint (CHARIE_TTS_URL) -> browser voice
Data: Firestore in prod (PORTAL_STORE=firestore), JSON files locally
```

Components:

| Component | Path | Runtime | Job |
|---|---|---|---|
| Portal | `apps/portal/` | Next.js 15, React 19 | Workspace UI, auth gate, rooms, approvals, reports, Meet signaling, Chat UI |
| Agent engine | `services/agent-engine/` | Node, TypeScript, Playwright | Investigation loop, scans, Guardian brain, vision, chat agent, pentest |
| Demo target | `apps/demo-target/` | Next.js | Demo Site, an intentionally buggy store plus a fixed build for verification |
| MCP server | `services/mcp-server/` | Node stdio | Lets coding agents pull findings and fix packets locally |
| TTS | portal `api/meet/rooms/[id]/tts` + `services/modal-tts/modal_app.py` | Cartesia Sonic, then Modal Kokoro-82M, then browser voice | Charie's spoken voice in Meet (section 10) |
| Web SDK | `apps/portal/public/charie.js` | Browser script | Drop-in production error and signal reporting |
| Deploy | `deploy/` | Docker, Cloud Build | Images for the three Cloud Run services |

The portal never calls model providers directly for investigation work; it calls the engine over HTTP with a shared token. The engine is the only place Playwright runs, which is why hosting is Cloud Run rather than static hosting: the engine needs a real Chromium, memory (4Gi, 2 CPU in prod), concurrency 1, and a long timeout (3600s).

## 3. Repository map

| Path | Contents |
|---|---|
| `apps/portal/app/(workspace)/` | Authenticated pages: home, tickets, chat, reports, ux, a11y, firstrun, guardian, marketplace, repos, agents, autopilot, team, settings |
| `apps/portal/app/(workspace)/api/` | Portal JSON APIs (meet, chat, guardian, tickets, repos, team, cron, mcp entry) |
| `apps/portal/app/meet/guest/[id]/` | Public guest join page for Meet invite links |
| `apps/portal/app/login/` | Firebase Google or email login plus local-owner dev login |
| `apps/portal/components/` | Meet room, chat widget, marketplace, charts, command palette, shared UI |
| `apps/portal/lib/` | Store, sessions, meet live-call state, room status, repos, GitHub, GCP helpers |
| `apps/portal/test/` | Portal unit tests (sessions, CSP, meet rooms, room status, presence, keys) |
| `services/agent-engine/src/` | Engine modules listed in section 6 and 21 |
| `services/agent-engine/test/` | Regression, server, guardian-plus, access, chat-agent, vision suites |
| `services/agent-engine/reports/` | Local run output: one folder per run timestamp |
| `services/mcp-server/src/` | MCP adapter over engine reports |
| `docs/` | Architecture, demo script, Meta stack, Firestore schema, mobile SDK, roadmap, this file |

## 4. Identity, accounts, and sessions

- Login is Firebase Authentication (Google provider, or email and password with reset emails) at `apps/portal/app/login/page.tsx`.
- The browser sends the Firebase ID token to `POST /api/session`. The portal verifies it and sets an HMAC-signed session cookie named `charie_session`.
- Middleware (`apps/portal/middleware.ts`) gates every workspace route. There is no unauthenticated workspace page.
- Two fallbacks exist for automation and local judging: a local-owner dev login (one click, local only) and an `AUTOMATION_KEY` path for scripted checks.
- Every record carries the owning `uid`. Portal APIs filter by the session account; engine Guardian data lives in per-account partitions (`_guardian/acct/<uid>` under the reports root).
- Settings (name, theme, preferences) are per account and editable in tabbed Settings. Theme is owned by the server: the `charie-theme` cookie decides the server-rendered `data-theme`, and localStorage syncs to it, so a chosen light or dark theme sticks across pages, reports, and new tabs instead of flashing or reverting.

## 5. The core spine: ticket, evidence, fix, proof

Every product runs the same loop:

1. **Intake.** A human files a ticket in the portal, speaks one (voice ticket), a production signal is converted in one click, a GitHub repo event files one, or Charie proposes one on a call as a consent card.
2. **Investigation.** The engine drives the real target app (section 6) and produces typed findings with evidence.
3. **Room.** Findings land in a shared issue room with screenshots, repro steps, logs, and model analysis labelled by source.
4. **Approval.** A human approves one fix instruction. Nothing consequential runs before this.
5. **Fix.** The instruction goes to a coding agent over MCP as a fix packet, or is dispatched in product where supported.
6. **Verification.** The verifier re-runs the identical journey against the new build and writes a before/after diff.
7. **Proof and close.** The ticket closes with the proof package; the same evidence is reachable from Reports, the ticket, and Chat.

Finding lifecycle: `open -> fix_proposed -> verified | regressed`. A regression reopens the conversation instead of hiding.

Tickets page sections (`apps/portal/app/(workspace)/tickets/page.tsx`): tickets tagged `meet:` (filed from live calls) render in an **On-call tickets** section first, pre-digested for a fast decision - call summary (the ticket body), the investigation's top finding, its root cause (`suspectedCause`), the proposed fix (`suggestedFix`), the approval state (approved instruction on file, or ticket verified/closed, versus waiting), and links to the ticket and the investigation report. Everything else renders as **Engineering tickets** in the full table. Approving still happens on the ticket page itself; the section is a decision surface, not a second approval path.

## 6. Investigation engine (Playwright loop)

Entry points: CLI `services/agent-engine/src/run-loop.ts` (`npm run agent:run -- --target <url>`) and HTTP service `src/serve.ts` plus `src/server.ts`. Both share `src/job.ts`, so CLI and cloud runs behave identically.

Pipeline per run:

| Stage | File | What it does |
|---|---|---|
| Explorer | `src/explorer.ts` | Drives the target with Playwright Chromium toward the goal; records actions, assertions, screenshots, console errors, failed network requests |
| First-time-user simulation | `src/explorer.ts` (sim pass) | Re-runs the goal without privileged UI knowledge; records hesitation signals: backtracks, repeated clicks, dwell, detours, abandonment |
| Surface and security notes | `src/surface.ts` | Safe, authorized surface checks on the scoped target |
| Evidence analyst | `src/analyst.ts` | Converts traces into typed findings: severity, suspected cause, suggested fix, confidence, repro steps |
| Model enrichment | `src/meta-client.ts`, `src/wonder.ts`, `src/baseten.ts`, `src/glimmer.ts` | Spark cause/fix prose, Wonder deep dives, Spark Open second opinion, Glimmer triage (section 21) |
| Grounding | `src/grounding.ts` | SAM 3.1 boxes over failure screenshots (section 21) |
| Redesign briefs | `src/redesign.ts` | Muse Image alternatives for usability findings (section 14) |
| Reporter | `src/reporter.ts` | Writes `report.md`, static HTML, `findings.json`, traces, and per-finding MCP packets to `reports/<timestamp>/` |
| Verifier | `src/verifier.ts` | Re-runs identical journeys against the fixed build; writes `verification.json` with before/after diff |
| Storage | `src/storage.ts` | Uploads report artifacts to GCS when `GCS_BUCKET` is set; local disk otherwise |

Run identity: `CHARIE_RUN_ID` and `CHARIE_REPORTS` environment variables name runs and the reports root. Historic names kept for stability: the GCS bucket keeps its `-ghostqa` suffix and the npm scope stays `@circle-back/*`.

Engine HTTP surface (`src/server.ts`, all behind `ENGINE_TOKEN` except health):

| Endpoint | Job |
|---|---|
| `GET /health` | Liveness |
| `POST /runs`, `GET /runs/:id`, `GET /runs/:id/artifacts/*` | Start an investigation, poll it, fetch evidence |
| `POST /chat/turn` | One tool-using chat turn (section 7) |
| `POST /vision/describe` | Describe one screen frame (section 9) |
| `POST /triage` | Glimmer ticket triage |
| `POST /transcribe` | Voice ticket transcription |
| `POST /guardian/analyze`, `/guardian/respond`, `/guardian/verify` | Incident verdict, response plan, fix verification |
| `GET/POST /guardian/sweeps`, `POST /guardian/sweep` | Continuous sweep control |
| `GET/POST /workorders`, `/workorders/:id/approve`, `/workorders/:id/schedule` | Guard fix tasks |
| `POST /nightshift/run`, `GET /nightshift/digests` | Night shift execution and morning digests |
| `POST /signals/ingest`, `GET /signals/clusters`, `POST /signals/seed` | Production signal intake and clustering |
| `POST /pentest/run`, `GET /pentest/reports` | Security test suite (section 12) |
| `POST /a11y/run`, `GET /a11y/reports` | Accessibility scans (section 13) |
| `POST /firstrun/run`, `GET /firstrun/reports` | First-run scoring (section 13) |
| `POST/GET /guardian/logwatch` | GCP log watch runs and history |
| `GET /zoom/status`, `POST /zoom/join` | External Zoom bot fallback via Recall.ai (`src/zoom.ts`) |

Safety: the engine refuses to start unauthenticated. Local development opts out explicitly with `ENGINE_DEV_OPEN=1`. SSRF guards reject private and loopback targets for remote checks unless the target is the explicitly scoped local demo.

Concurrency truth: the engine runs one browser investigation at a time in prod (Cloud Run concurrency 1). If a second run is requested while one is active, the portal now surfaces the busy state plainly (including HTTP 429 from preflight) instead of reporting the engine as unreachable.

## 7. Chat agent (the operator brain)

Chat is an operator, not a chatbot. Implementation: `services/agent-engine/src/chat-agent.ts`, reached from the portal chat page and widget through `POST /api/chat/turn` to engine `POST /chat/turn`. The Meet agent uses the exact same brain (`apps/portal/lib/call-agent.ts` adapts it to the call).

How a turn works:

1. The portal sends the conversation, the selected model and effort, and account context.
2. The engine runs a tool loop: the model may call tools that file tickets, start scans, read findings, check build and run status, and read reports. Each tool result returns to the model for the next step.
3. Every executed action produces a receipt shown in the UI, so a user can see what Charie actually did, not just what she said.
4. Model order (important, often misread): the Chat and Meet brain is **not** `muse-spark-1.3` by default. In Auto mode it calls **Baseten first: Muse Spark Open `meta-models/muse-spark-open-1026`** (open weights served by Baseten, a different model from `muse-spark-1.3`) when `BASETEN_API_KEY` resolves, then **Meta Model API directly: Muse Spark `muse-spark-1.3`**, then the built-in heuristic router. Code: `services/agent-engine/src/chat-agent.ts` provider order comment and selection (`hasBasetenKey() && model !== "meta"` first, `chat()` with `modelId("spark")` second). Chat exposes pills to force Baseten, Meta, or Heuristic (`apps/portal/lib/chat-models.ts`); Meet has no picker, so Auto order always applies in calls (`apps/portal/lib/call-agent.ts` calls the same `answerMessage` loop with `surface: "meet-call"`). The reply carries its model label (for example `(baseten)` or `heuristic`) so the source is never hidden.
5. Parsing is defensive. Replies are expected as structured output, but if a model answers in prose with braces in it, a salvage pass extracts the intent instead of dead-ending with "I could not parse that". Regression tests cover this (`services/agent-engine/test/chat-agent.test.mts`).
6. UI contract: the chat page never scrolls as a page. Only the message pane scrolls. Model and effort are compact pill controls, chosen to stay small and quiet next to the composer.

Consent: tools that change state (filing, scanning, dispatching) follow the same approval rules as the rest of the product. In Meet, proposed actions appear as consent cards in the room and run only after a participant approves.

Live-call latency discipline (the Meet surface of this same loop): a call cannot wait for a five-turn agent loop, so `surface: "meet-call"` caps the loop at 2 tool turns (`apps/portal/lib/charie-chat.ts`), the call adapter sends only the last 6 transcript lines as history (`apps/portal/lib/call-agent.ts`), the Meta lane's meet-call token budget is 500 (Baseten stays 1200 because its reasoning spends tokens before words), and every spoken reply passes a deterministic clamp - at most two sentences, about 260 characters - however verbose the model was (`clampCallReply` in `apps/portal/lib/room-status.ts`, unit-tested). The prompt demands answer-only responses (yes/no questions get yes/no first); if the engine is unreachable the spoken fallback is one honest short line, never filler. Fine-tuning was evaluated and rejected for this: the latency was loop depth and token budget, not model knowledge.

## 8. Meet: live calls with Charie inside

Meet is a native video product in the portal, not an embedded third-party call.

Surfaces:

- Room list and creation: `apps/portal/app/(workspace)/guardian/zoom/page.tsx`.
- Room page: `apps/portal/app/(workspace)/guardian/zoom/rooms/[id]/page.tsx` with `apps/portal/components/meet.tsx`.
- Public guest page: `apps/portal/app/meet/guest/[id]/page.tsx`.
- APIs under `apps/portal/app/(workspace)/api/meet/rooms/[id]/`: `signal`, `live`, `snapshot`, `vision`, `tts`, `agent`, `guest`, `invite`, `memory`, `summarize`, `export`, `settings`, `save`, `end`, `reopen`.

Media and signaling:

- Video and audio are mesh WebRTC between browsers with STUN. There is no TURN relay yet; strict NATs can fail to connect (section 31).
- Signaling (join, leave, offers, answers, end) is exchanged through the portal `signal` API with per-room cursors. Peers that never connect time out and can be removed.
- Anyone with the guest invite link can join as an external participant after a consent-first check-in that can attach the call to a support ticket. Product copy says this plainly: Meet is for customer calls, not internal-only calls.
- Camera starts off and participants start muted by default. Charie is a labelled agent participant, never a hidden recorder.
- Leaving, ending, or navigating away from a room stops every local and screen-share track, detaches both video elements, and disarms the lobby preview, so the camera light goes out immediately without a page refresh. The preview only re-acquires when the user explicitly switches the lobby camera on.

Charie in the call:

- She joins as an agent tile, greets briefly, listens through browser speech recognition, and answers out loud (section 10).
- The Charie panel sits before the Transcript panel in the room layout, because she is the headline feature.
- She answers from the same chat-agent brain as Chat, with call context: transcript so far, live notes, screen memory (section 9).
- She proposes investigations and fix actions as consent cards. She states in her greeting that she will not run anything without approval, and the code enforces it.
- A floating Charie widget (`CharieWidget` in `apps/portal/components/meet.tsx`) shows her replies as text the moment they post, before the voice finishes. It drags by its header, resizes by a corner handle (width and height clamped to the viewport), minimizes to the header bar, and maximizes/restores. **Pop out** moves it into a Document Picture-in-Picture window (Chrome/Edge): an always-on-top floating window that stays visible over other tabs and apps, carries the room theme, updates live through a React portal, and docks back on request. A web page cannot draw over other desktop apps by itself; PiP is the no-install mechanism that achieves it, and it is visible in a screen share only when the entire screen is shared.
- Tickets filed from a call are tagged `sourceRepo: meet:<roomId>` at filing time (`apps/portal/lib/call-agent.ts`), which is what the Tickets page On-call section and the call-to-ticket lookup both key on.
- Live notes and the transcript save to the room and its linked ticket when opted in. A summary can be generated at the end (`summarize`), and the room exports (`export`).

Room lifecycle and reopening:

- Ending a call finalizes and saves the transcript, notes, and screen memory. It never wipes them: an empty live-memory save cannot overwrite a saved transcript.
- Reopening an ended room shows the saved room first: transcript, progress, notes, and screen history, with a Rejoin action. It does not drop the user back into a fresh camera preview.
- Rejoin primes the signaling cursor past old join and end signals before connecting, so replayed history cannot instantly end the new call or resurrect a ghost "teammate" tile from the previous session.
- Rooms belong to the account that created them; the guest link is the only unauthenticated path in, and it is scoped to that room.

## 9. Screen vision and continuous watch

This is the feature judges usually ask about first: how can Charie answer "what is on my screen right now" and "what happened a few minutes ago" without a video model?

Capture model:

- When a participant shares a screen, the sharer's browser holds the real video track. Charie never gets a raw video stream on the server; she gets still frames captured in the browser from that track.
- Asking a screen question ("can you see my screen", "what is this error") triggers a fresh capture first, then the vision call. She answers from that frame, not from memory of an older one.
- Watch mode samples the shared screen locally every 3 seconds, computes a pixel difference against the last sent frame, and only uploads a frame when the screen actually changed (minimum 4 seconds apart, 30 second heartbeat even when static). This is how she "watches continuously" without uploading 20 frames a second or burning model calls on an unchanged desktop.
- Every accepted frame is timestamped (`capturedAt`) and stored in the room's screen log (`MeetRoom.screenLog`, via `apps/portal/lib/livecall.ts`). Out-of-order results are dropped, so a slow answer about an old screen can never overwrite newer memory. That log is the memory she answers history questions from: "what did it show at 21:22" resolves to the nearest real captured frame, deterministically, in `apps/portal/lib/room-status.ts`.

Vision call (`services/agent-engine/src/vision.ts`, portal route `api/meet/rooms/[id]/vision`):

1. Lane order: Meta Muse Spark vision first (`muse-spark-1.3` at `https://api.meta.ai/v1`), then Baseten Muse Spark Open (`meta-models/muse-spark-open-1026`). Both use the OpenAI-compatible `image_url` chat shape.
2. Fast mode for live questions: one short sentence, maximum 25 words, small token budget. Full mode for deliberate looks: 2-3 short spoken sentences naming the error and the next click.
3. Reasoning models spend tokens thinking before answering. Budgets are sized for that (900 tokens full, 2200 on the empty-answer retry), because a 400-token budget starved them into empty replies.
4. The parser reads `content` (string or text parts) and deliberately never speaks `reasoning_content`. Reasoning text that leaks into content ("We need to answer in ONE short sentence...") is detected and rejected, then retried once at full budget. This was a real bug heard by users; it is covered by `services/agent-engine/test/vision.test.mts`.
5. Honesty rules: screen questions are detected (`isScreenSeeQuestion`) and answered from real state. If vision is enabled and a frame exists, she says what it shows with its time. If no frame exists, she says she cannot see it yet and exactly how to enable it (share screen, turn on "Charie can look", press look). She never claims to see a screen she has no frame for, and negations in watch observations are stripped so "no error visible" is never misread as an alarm.
6. While the vision call runs, the client plays a short spoken bridge ("Looking.") so the call never sits in dead silence, then speaks the real answer when it lands.

Watch-mode speech discipline:

- Silent by default. She speaks in watch mode only for a real problem or change worth naming, at most once per 45 seconds, and never the same observation twice.
- Every spoken watch line comes from an actual captured frame stored in the log, so the transcript, the memory, and the voice cannot disagree.

Latency truth: the design target is a spoken answer in about 2-3 seconds on a warm stack (warm TTS container, fast lane, fresh frame). The system cannot guarantee that bound on a cold model endpoint. When a reasoning model burns its budget thinking and answers empty (`finish_reason=length`), vision retries at escalating token budgets (2200, then 4000) on every lane before failing, and the portal shows a plain "could not get a clear look at that frame" message on the tile instead of raw provider diagnostics.

## 10. Voice: speech in, speech out

Speech recognition (hearing humans):

- Browser Web Speech API in the Meet room. Free, on-device where the browser supports it, no key.
- Barge-in: when a final human speech result arrives, Charie stops speaking immediately (audio element paused, queue cleared). An echo guard prevents her own speaker output, re-heard by the microphone, from triggering false barge-ins or self-replies.
- Muse Voice Transcribe (`muse-voice-transcribe-1.0`) is the server-side transcription path used for voice tickets (record a bug report, get a structured ticket), via engine `POST /transcribe` and `src/voice.ts`. It is not the live-call recognizer; the call uses the browser recognizer for latency.

Speech synthesis (Charie speaking):

- Primary when configured: Cartesia Sonic (third-party TTS; the hackathon rules allow it since Meta ships no TTS, and Muse Spark remains the brain). Set `CARTESIA_API_KEY` (and optionally `CARTESIA_VOICE_ID`, `CARTESIA_MODEL=sonic-2`) on the portal. Per-clause synthesis returns first audio in well under a second; a 12s timeout drops to the next provider instead of stacking latency. The `x-charie-tts` response header names the provider that served each line, and Test voice reports it.
- Fallback: Kokoro-82M on Modal, `services/modal-tts/modal_app.py`. Warm American male voice `am_michael`, CPU container, pipeline loaded once per container and reused. `min_containers=1` keeps one container always warm so the first line in a call does not pay a 20 second cold start; `scaledown_window=1200` keeps it warm through a call. Deploy: `modal deploy services/modal-tts/modal_app.py`, then set `CHARIE_TTS_URL` on the portal.
- Portal route: `api/meet/rooms/[id]/tts`. Requests are deduplicated (one shared in-flight request per line) and cached briefly per provider, so a line is never synthesized twice.
- Playback is sequential sentence chunks, first chunk short (about 70 characters) so speech starts on the first clause while the rest synthesizes. Only the next chunk's first part is prefetched. Parallel chunk playback (which queued and overlapped) is deliberately not used.
- Ending the call or leaving the page pauses the audio element and clears the queue. Charie's voice cannot follow the user to the home page.
- Fallback: with neither Cartesia nor `CHARIE_TTS_URL` configured, the portal uses the best local browser voice. It is more robotic; the product does not hide that.
- Speakable text: everything spoken passes a cleaning pass that strips markdown, links, ticket ids, and meta-commentary, and Charie's replies are prompted to be brief - one short sentence by default, like a person on a call, not a paragraph.
- Test path: "Test Charie's voice" in the room synthesizes the real greeting through the same pipeline and reports end-to-end time, and names a cold start as a Modal-side cold start when that is what happened.

Voice cloning status: not shipped. A fine-tune of an open TTS model on the founder's voice, hosted on Modal the same way, was scoped (recording script, training run, endpoint swap behind `CHARIE_TTS_URL`) but deliberately deferred during the hackathon. The call voice is Cartesia Sonic when configured, Kokoro otherwise. Any future clone ships only with the voice owner's recorded consent.

## 11. Charie Guard: threats, incidents, night shift

Guard is the post-deploy product: `apps/portal/app/(workspace)/guardian/` in the portal, `guardian.ts`, `workorders.ts`, `nightshift.ts`, `signals.ts`, `logwatch.ts`, `sweep.ts` in the engine.

Event sources:

- Log watch (`src/logwatch.ts`): reads the connected GCP project's real error logs on demand or on schedule.
- Web SDK (`apps/portal/public/charie.js`): a drop-in script that reports production errors and signals from a customer's web app, authorized by an app key.
- Signal ingest API (`POST /signals/ingest`, portal `/api/guardian/events`): server-side events with the same key model.
- Mobile contract ([MOBILE_SDK.md](MOBILE_SDK.md)): the documented payload native apps send to the same ingest.
- Continuous sweeps (`src/sweep.ts`): scheduled re-checks of scoped targets.
- Security tests (section 12) and simulated attacks (portal "Simulate attack" for demos).

Detection and triage:

- Detectors are deterministic rules over event windows: credential stuffing, account takeover patterns, API abuse, exfiltration shapes. Models never gate detection alone.
- Muse Glimmer pre-filters noise before investigation (fail-open: if Glimmer is unreachable, events still flow).
- Muse Spark produces the incident verdict, timeline, and response plan. Muse Spark Open independently challenges the verdict; disagreement flags the incident for human review instead of hiding uncertainty. Muse Wonder plans the deep response for blocker incidents.

Response loop:

1. Incident opens with verdict first: what happened, how bad, what to do. Detail is one click deeper, never the landing view.
2. A human approves a response. Fix tasks (work orders) are proposed from the incident with concrete steps.
3. Approved work orders execute through the engine (`/workorders` APIs) and attach proof: what ran, what changed, what the re-check showed (`/guardian/verify`).
4. Night shift (`src/nightshift.ts`, portal Night shift page) runs approved autonomous work overnight: sweeps, re-scans, queued fix tasks, log watch. The morning digest lists executed work, proofs, failures, and items waiting on a human. Nothing in the digest is invented: entries come from executed run records. The portal renders the digest text as a visual report, not a raw text block: a summary lead, one icon row per result with PASSED/SCHEDULED/FAILED status chips, the security row linking to the full re-scan report with grade and pass count, log-watch rows linking to Live Signals, and a work-done card listing each executed order with proof counts and links (`digestRows` in the Night shift page).
5. Push alerts (web-push, portal `/api/push/subscribe`) notify on new blocker incidents.

## 12. Security tests (pentest suite)

`services/agent-engine/src/pentest.ts`, portal Security tests page, engine `POST /pentest/run`.

- A suite of automated, safe checks against the scoped live services (the portal and engine themselves, or a target the account owns): TLS posture, session cookie flags and session handling, SSRF guards, SSTI and SQLi probes with harmless payloads, scheme and header checks, recon (what the target exposes publicly).
- Every check reports passed, failed, or skipped with a reason. A skipped check is shown as skipped, never silently counted as passed.
- Rules: authorized targets only, no destructive payloads, no third-party scanning. The report states scope and limitations on its face.
- Results feed the same spine: failures can become incidents and fix tasks, and re-running after a fix is the verification.

## 13. Accessibility and first-run scoring

Accessibility (`src/a11y.ts`, portal Accessibility page, `POST /a11y/run`):

- Eight checks over the rendered page (contrast, labels, landmarks, focus order, alt text, heading structure, target size, keyboard traps) producing a letter grade with per-check evidence and fix guidance.
- Findings can flow into tickets and UX work like any other finding.

First run (`src/firstrun.ts`, portal First run page, `POST /firstrun/run`):

- Six first-time-user checks simulating a brand-new visitor: can they tell what the product is, find the primary action, complete the core journey, recover from an error, and understand the result.
- Produces a score with step-by-step evidence from the same Playwright trace machinery as investigations.

Both are graded, screenshot-backed, and honest about being simulations (design rule 2 and 3 in [ARCHITECTURE.md](ARCHITECTURE.md)).

## 14. UX analysis and generated redesigns

- Usability findings from investigations (hesitation signals, abandonment points) appear on the UX and redesign page with written briefs: problem, evidence frame, proposed direction.
- With `META_API_KEY`, Muse Image (`muse-image-1.0`, `src/redesign.ts`) generates 2-3 alternative screens per usability finding (first two findings per run), stored with the report and shown next to the evidence so a human compares real screens, not adjectives. Trade-offs and a component-level plan accompany each set.
- Without the key, briefs still render and the page says generated screens need the key. Nothing is faked with stock images.
- Approved directions become tickets in the same spine.

## 15. Reports and Ask Charie

- One Reports index (`apps/portal/app/(workspace)/reports/`) lists every investigation, scan, pentest, verification, Guardian analysis, and digest for the account, with working timeframe filters (today, 7 days, 30 days, all) computed from real record timestamps.
- Report pages (`reports/[kind]/[id]`) are verdict-first: the outcome banner (what ran, pass or fail, why it failed when it failed, including the engine's own error text) sits at the top, evidence and detail below in a single readable column. No left-title/right-answer split with dead space in the middle.
- Report links are the same component pattern everywhere they appear: ticket pages, chat receipts, home activity, Guard pages, and Meet rooms all link to the canonical report URL for the run.
- **Ask Charie about this report** opens Chat in a new thread with the report linked as context, so follow-up questions ("why did the checkout check fail?") are answered against the actual report, not from memory.
- Failed runs say why: the engine's error (for example a busy engine or an upstream model failure) is stored on the run and rendered in the banner, prospectively for every new run.

## 16. Home analytics and checklist

- Home (`apps/portal/app/(workspace)/page.tsx`) shows analytics computed from the account's real records: run activity over time, outcome mix, severity distribution, recent agent activity, and the priority queue.
- Charts are drawn from those records with hover values on every graph. Nothing is a hardcoded wedge: the outcome pie segments are the account's actual verified, open, and regressed counts (an earlier decorative wedge was removed for exactly this reason).
- The getting-started checklist is a compact side widget, not a top banner. Layout rule for the whole portal: pages fit the viewport and only inner panes scroll; a page scrolls as a whole only when it genuinely holds more data than fits.

## 17. Repos, builds, and GitHub sync

- Connect a GitHub repo (OAuth, portal `/api/github/*`, `apps/portal/lib/github.ts`). Cloud Build compiles it and Cloud Run hosts it (`lib/gcp.ts`).
- Pushes arrive through the GitHub webhook; the connected repo rebuilds, retests, and posts status back to the commit.
- A repo event can file its own ticket, which enters the spine: investigation, approval, fix packet, verification.
- Jira syncs both ways through the Marketplace: tickets pull in, proof syncs back on close.

## 18. Marketplace, connectors, and MCP for coding agents

- Marketplace (`components/marketplace.tsx`) lists integrations with neutral letter monograms and plain names, plus a trademark note. Charie deliberately does not redraw third-party logos: naming a connected service is nominative use; republishing recoloured logo artwork would breach brand guidelines and mislead users about endorsement.
- Connectors API (`/api/connectors`) stores per-account connector config and test results; sync rules (`/api/sync-rules`) define what flows where and can be run on demand.
- MCP, two flavours, same contract:
  - Cloud: `POST /api/mcp` on the portal, authorized with the account ingest key. No local checkout needed.
  - Local: `services/mcp-server/` stdio server over engine reports (`npm run smoke` verifies it).
  - Tools let a coding agent (Muse Code first) list findings, fetch a finding with repro steps and evidence, fetch fix packets (`mcp-packets/*.md` written by the reporter), and check verification proof. The contract requires the agent to check proof before declaring a fix done.
  - The Integrations page generates copy-paste configs for both flavours.

## 19. Production signals: log watch, web SDK, mobile contract

- Log watch reads the connected GCP project's errors directly; no agent to install.
- The web SDK is one script tag (`public/charie.js`) plus an app key from the Team page. It reports errors and custom signals to `/api/guardian/events`.
- Mobile apps follow [MOBILE_SDK.md](MOBILE_SDK.md): same ingest payload, native wrappers are roadmap, the contract is live today.
- Signals cluster into incidents (`/signals/clusters`); a cluster converts to a ticket in one click, entering the spine.
- Live site monitor (Live Signals page, `LiveMonitorPanel` in `apps/portal/components/suite.tsx`): the browser polls `GET /api/guardian/live-monitor` every 3 seconds. Each poll is a real probe round measured at request time (`runLiveProbe` in `apps/portal/lib/live-monitor.ts`): home page, `/api/products`, `/api/build` flavor, and a 3-item checkout POST that exercises the demo site's seeded failure. The panel plots measured home-page latency (one point per probe, green/red by success), per-check status and milliseconds, and timestamped signals derived from the responses (`deriveSignals`, unit-tested for buggy, fixed, down, and slow sites). Nothing is simulated or cached: stop the target and the panel goes red within one poll; run the fixed build and the checkout signal turns green. Target resolution: `DEMO_TARGET_URL` env, then the account's configured default target, then the demo site (hosted Cloud Run demo when the portal is hosted, `http://localhost:3101` locally).

## 20. Autopilot, schedules, cron, and push alerts

- Autopilot (portal Autopilot page, `/api/autopilot/schedules`) schedules sweeps, security re-scans, night shifts, and log watch per account.
- A cron tick (`/api/cron/tick`, `CRON_KEY` protected) advances due schedules in prod. The same tick path runs locally on demand.
- Agents page (Coding agents) hands runs to external coding agents and tracks their state honestly: stage text describes what is actually running; fabricated percentage progress was removed and is not coming back.

## 21. Meta models: exact usage, files, prompts, fallbacks

Rule: a model counts as used only after a real request succeeds. Every call site below fails soft to the labelled heuristic.

| Model | ID and endpoint | Job | Code | Prompt shape | Fallback |
|---|---|---|---|---|---|
| Muse Spark | `muse-spark-1.3`, `https://api.meta.ai/v1` (`META_API_BASE_URL`, Meta direct) | Finding cause/fix enrichment, incident analysis, screen vision lane 1, Chat/Meet Meta lane (only when picked in Chat or when Baseten is unavailable) | `src/meta-client.ts` (`chat`, `enrichFinding`, `modelId`), `src/analyst.ts`, `src/chat-agent.ts`, `src/vision.ts` | Enrichment: exactly two lines, `CAUSE:` then `FIX:`. Vision fast: one sentence, max 25 words. Chat: tool-loop system prompt | Heuristic analyst and router; reply labelled `heuristic` |
| Muse Wonder | `muse-wonder-1.0` | Deep-dive escalation for low-confidence or multi-file findings, blocker incident planning | `src/wonder.ts` | Root-cause plus fix proposal replacing low-confidence Spark prose | Spark prose stays, confidence unchanged |
| Muse Image | `muse-image-1.0` | Screen redesigns from usability findings | `src/redesign.ts` | Evidence-linked generation, 2-3 alternatives plus trade-offs and component plan | Written briefs only, page says screens need the key |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | Voice bug reports to structured tickets | `src/voice.ts`, engine `POST /transcribe`, portal intake | Transcription to goal plus repro fields | Manual text intake |
| SAM 3.1 | `sam-3-1` | Grounding boxes on failure screenshots and before/after diff regions | `src/grounding.ts` | Segmentation of the cited control; boxes stored in `findings[].grounding` | Whole-shot fallback box, UI chip "Grounded by SAM 3.1" only when real boxes exist |
| Muse Spark Open | `meta-models/muse-spark-open-1026`, `https://inference.baseten.co/v1` (Baseten, open weights, not `muse-spark-1.3`) | Default Chat and Meet brain in Auto mode, second-opinion re-grade of findings, adversarial check on Guard verdicts, vision lane 2 | `src/baseten.ts` (`sparkOpenChat`, `secondOpinion`, `parseGrade`), `src/vision.ts`, `src/chat-agent.ts` | Re-grade: exactly `SEVERITY:` then `NOTE:`. Disagreement lowers confidence | No second opinion; confidence unchanged |
| Muse Glimmer | Open weights, Ollama `http://localhost:11434/v1`, model `muse-glimmer:30b` by default (`GLIMMER_ENDPOINT`, `GLIMMER_MODEL`) | Ticket triage: goal extraction, severity pre-grade, dedup; Guard noise pre-filter | `src/glimmer.ts`, `src/triage.ts`, engine `POST /triage` | Small structured extraction prompts | Heuristic triage, fail-open |
| Muse Code | Meta coding agent | Built this repo; at runtime consumes MCP fix packets and returns fixes for verification | `services/mcp-server/`, portal `POST /api/mcp` | Fix packet markdown per finding | Human applies the fix manually |

Model identity plumbing: engine `modelId()` in `src/meta-client.ts` resolves IDs from secrets with verified defaults (`muse-spark-1.3`, `muse-wonder-1.0`, `muse-image-1.0`, `muse-voice-transcribe-1.0`, `sam-3-1`). The portal chat model picker (`apps/portal/lib/chat-models.ts`) exposes Muse Spark 1.3 and the open lanes with provider labels. A regression test pins every default ID (`services/agent-engine/test/regression.test.mts`).

Reasoning-model handling (learned in production testing): Spark-family models reason before answering. Text chat falls back to `reasoning_content` when visible content is empty after reasoning eats the budget (`src/baseten.ts`). Vision deliberately does the opposite: `reasoning_content` is never spoken, leaked reasoning in content is rejected, and the retry budget rises to 2200 tokens (section 9). Same model family, opposite handling, because one surface is read and the other is heard.

Guardian model choreography is summarized in [META_STACK.md](META_STACK.md): Spark verdict, Spark Open adversarial challenge, Glimmer pre-filter, Wonder deep plan for blockers.

## 22. Non-Meta services: Modal voice, Baseten, Firebase, Google Cloud

| Service | Used for | Notes |
|---|---|---|
| Cartesia | Sonic TTS, primary call voice when `CARTESIA_API_KEY` is set on the portal | Third-party TTS (Meta ships none; allowed under hackathon rules with Muse as the brain). Per-clause first audio well under a second; portal mounts the secret from Secret Manager |
| Modal | Kokoro-82M TTS hosting (`services/modal-tts/modal_app.py`) | CPU, `min_containers=1`, `scaledown_window=1200`, voice `am_michael`. Voice fallback behind Cartesia. Not a Meta model; named honestly wherever voice is described |
| Baseten | Muse Spark Open inference | The account key works with `meta-models/muse-spark-open-1026`; that slug is the default in `src/baseten.ts` |
| Firebase Auth | Google and email login, password reset | ID token verified at `POST /api/session`; no Firebase Hosting (engine needs Chromium) |
| Cloud Run | `charie-portal`, `charie-engine` (4Gi, 2 CPU, concurrency 1, 3600s timeout), `charie-demo` | Preview service `charie-preview` |
| Firestore | Prod data store, `(default)` database in nam5 | Selected with `PORTAL_STORE=firestore`; schema in [FIRESTORE_SCHEMA.md](FIRESTORE_SCHEMA.md) |
| Cloud Storage | Report artifacts, screenshots, generated screens | Bucket keeps the historic `-ghostqa` suffix (internal name only) |
| Secret Manager | All keys at runtime | Engine reads directly; portal receives mounted env for `ENGINE_TOKEN`, `FIREBASE_WEB_CONFIG`, `AUTOMATION_KEY`, `SESSION_KEY` |
| Artifact Registry, Cloud Build | Images and connected-repo builds | Registry repo `charie` |
| Recall.ai (optional) | External Zoom bot fallback | Native Meet is primary; Zoom join is the fallback path (`src/zoom.ts`) |

## 23. Data model and storage

Two store implementations behind one interface, selected by `PORTAL_STORE`:

- Local and judges: JSON files under `apps/portal/.data/`.
- Prod: Firestore collections per [FIRESTORE_SCHEMA.md](FIRESTORE_SCHEMA.md).

Principal records: accounts and sessions, tickets, issue rooms and messages, approvals, runs and reports, meet rooms (transcript, live notes, `screenLog` with `capturedAt` per frame, signals cursor state), Guardian incidents and work orders per account partition, signals and clusters, autopilot schedules, connectors and sync rules, team seats and app keys, chat threads.

Engine artifacts per run (`reports/<timestamp>/` locally, GCS in prod): `trace.json`, usability signals, `findings.json`, screenshots, `report.md` plus static HTML, `briefs.json` and `redesigns/` for UX, MCP packets, `verification.json` after a verify pass.

Retention truth: Meet saves transcript, notes, and screen descriptions only. Audio and video are never persisted. Screen log entries are model descriptions with timestamps, not a video recording.

## 24. HTTP API reference (portal and engine)

Engine APIs are listed in section 6. Portal APIs (all session-gated except guest join, SDK ingest with app key, GitHub webhook, and cron with `CRON_KEY`):

| Area | Routes |
|---|---|
| Session and account | `POST /api/session`, `/api/account`, `/api/settings`, `/api/auth/config` |
| Tickets and rooms | `/api/tickets`, `/api/rooms/[id]/messages`, `/api/approvals`, `/api/approvals/[id]/dispatch`, `/api/runs`, `/api/artifacts/*`, `/api/uploads/*` |
| Chat | `/api/chat/turn`, `/api/chat/threads`, `/api/chat/threads/[id]`, `/api/chat/consent`, `/api/chat/upload` |
| Meet | `/api/meet/rooms`, `/api/meet/rooms/[id]/{signal,live,snapshot,vision,tts,agent,guest,invite,memory,summarize,export,settings,save,end,reopen}` |
| Guardian | `/api/guardian/{incidents,analyze,respond,events,events/upload,simulate,signals,signals/seed,signals/ticket,logwatch,live-monitor,pentest,sweep,workorders,a11y,firstrun}`, `/api/guardian/incidents/[id]/voice`, `/api/guardian/workorders/[id]/{approve,schedule}`, `/api/guardian/zoom/join` |
| Repos and GitHub | `/api/repos`, `/api/repos/[id]`, `/api/repos/[id]/build`, `/api/builds/[id]`, `/api/github/{oauth/start,oauth/callback,repos,status,disconnect,webhook}` |
| Platform | `/api/mcp` (cloud MCP), `/api/connectors`, `/api/connectors/[id]/test`, `/api/context-docs`, `/api/sync-rules`, `/api/team/{keys,seats}`, `/api/autopilot/{schedules,tick}`, `/api/cron/tick`, `/api/push/subscribe` |

## 25. Security model

- Portal: always-on middleware auth gate, HMAC session cookie, CSP and security headers (tested in `apps/portal/test/csp.test.mts`), per-account data scoping on every query.
- Engine: bearer `ENGINE_TOKEN` on every route except health; refuses to start without it outside explicit local dev mode. SSRF guards on target fetching. Report artifact paths are traversal-checked.
- Meet: room ownership by account, guest access only through the unguessable invite link for that room, consent check-in before joining, no recording.
- Secrets: environment first, then Secret Manager (`services/agent-engine/src/secrets.ts`). Startup logs secret names and character counts only, never values. No `.env` file, no keys in the repo. The GCP service-account JSON must never be committed (see [AGENTS.md](../AGENTS.md)).
- Product security work (pentest, sweeps) is authorized-scope only, non-destructive, and reports limitations (section 12).
- Known hardening backlog, stated openly: the runtime service account still holds a broad role from setup and should be reduced to Secret Accessor plus Firestore User plus Storage Object Admin, and a downloaded key and a GitHub PAT should be revoked after the hackathon. These are tracked in [AGENTS.md](../AGENTS.md), not hidden.

## 26. Configuration and secrets

Secret names (values live in the environment or Secret Manager, never in code): `META_API_KEY`, `META_API_BASE_URL` (`https://api.meta.ai/v1`), `META_SPARK_MODEL`, `META_WONDER_MODEL`, `META_IMAGE_MODEL`, `META_VOICE_MODEL`, `META_SAM_MODEL`, `BASETEN_API_KEY`, `SPARK_OPEN_MODEL_ID`, `SPARK_OPEN_ENDPOINT`, `GLIMMER_ENDPOINT`, `GLIMMER_MODEL`, `GLIMMER_API_KEY`, `ENGINE_TOKEN`, `FIREBASE_WEB_CONFIG`, `AUTOMATION_KEY`, `CRON_KEY`, `SESSION_KEY`, `CHARIE_TTS_URL` (portal), optional `CHARIE_TTS_MODAL_KEY` and `CHARIE_TTS_MODAL_SECRET`, `CARTESIA_API_KEY` (portal, primary call voice when set; create the secret before the first deploy that mounts it or Cloud Run rejects the revision).

Behaviour matrix:

| Keys present | What upgrades | What stays |
|---|---|---|
| None | Nothing | Full loop in labelled heuristic mode, browser voice, no screen vision or generated redesigns (pages say so) |
| `META_API_KEY` | Spark prose, Wonder, Image redesigns, Voice tickets, SAM grounding, vision lane 1 | Rest unchanged |
| `BASETEN_API_KEY` | Chat first lane, second opinions, vision lane 2 | Rest unchanged |
| `CHARIE_TTS_URL` | Warm Kokoro call voice | Browser voice otherwise |
| `GLIMMER_ENDPOINT` reachable | Live triage | Heuristic triage otherwise |

Billing note, stated plainly for judges: a Meta subscription (for example Muse Power usage) and Meta Model API pay-as-you-go billing are different meters. Charie's API calls charge the API key's billing, not a chat subscription. That is a Meta platform fact, not a Charie setting; the app only decides whether a key is present.

## 27. Local development and the zero-key judge path

Prerequisites: Node.js 20+, npm. One install at the root covers all workspaces.

```bash
npm install
npm run demo:target
npm exec --workspace services/agent-engine -- playwright install chromium
$env:ENGINE_DEV_OPEN="1"; npm run serve --workspace services/agent-engine
npm run portal:dev
```

Ports: demo target 3101, portal 3102, engine 3103. Login: **Continue as local owner** on the login page (no Firebase project needed). The five-minute tour is in [README.md](../README.md).

Windows sandbox note for this repo's own development (in [AGENTS.md](../AGENTS.md)): npm needs a writable cache and `TEMP`/`TMP` redirected to a writable folder on constrained machines; server tests call handlers directly because listening sockets may be blocked.

## 28. Testing and verification

| Suite | Command | Covers |
|---|---|---|
| Engine regression | `npm run test --workspace services/agent-engine` (first file) | Seeded-bug loop finds the Demo Site bugs, model ID defaults, finding shape |
| Engine server | same command (second file) | HTTP handlers, auth, run lifecycle |
| Guardian-plus | same command (third file) | Incidents, work orders, night shift, signals |
| Access | same command (fourth file) | Account scoping and partition isolation |
| Chat agent | same command (fifth file) | Tool loop with a fake model, prose salvage parsing |
| Vision | same command (sixth file) | Content parsing, leaked-reasoning rejection, empty-answer handling |
| MCP smoke | `npm run smoke --workspace services/mcp-server` | Findings and fix packet serving |
| Portal | `npm test --workspace apps/portal` | Sessions, CSP, keys, meet rooms, presence, middleware, room status and screen replies, spoken-reply clamp, live-monitor signal logic and target resolution, demo seed consistency (incl. on-call tickets) |
| Typecheck | `npm run typecheck --workspace services/agent-engine` and `--workspace apps/portal` | Full TypeScript, both workspaces |
| Build | `npm run portal:build` | Production Next.js build |

Tests are offline-safe: model calls are stubbed with fake fetch implementations, so the suites pass with no keys and no network. Repo rule: a change is finished only after the touched area's suites pass in the same session.

## 29. Deployment and CI

- Images: `deploy/Dockerfile.portal`, `deploy/Dockerfile.engine`, `deploy/Dockerfile.demo` into Artifact Registry repo `charie`.
- CI: `.github/workflows/deploy.yml` on every push to `dev`: test, build, roll all three Cloud Run services, authenticated with Workload Identity Federation. No stored GCP keys in GitHub.
- Voice: `modal deploy services/modal-tts/modal_app.py` is a separate manual deploy; after changing the Modal URL in Secret Manager, the portal picks it up on its next Cloud Run revision (CI deploy on merge does this).
- Project facts: GCP project in `us-central1`, Firestore `(default)` in nam5. Details and open hardening items in [AGENTS.md](../AGENTS.md).

## 30. Performance and latency engineering

- Call voice: Cartesia per-clause synthesis when configured (first audio well under a second), Kokoro pipeline cached per warm container behind it, sequential short-first chunks, deduplicated synthesis requests, prefetch of only the next chunk. The slow path users hear is a cold container or a cold model endpoint; both are named in the UI when detected.
- Vision: fast lane with a tight sentence budget, fresh-frame capture only on question or change, local pixel-diff gating so static screens cost nothing, out-of-order drop so slow answers never rewind memory.
- Chat and Meet share one brain and one transcript poll (350ms in call), so spoken replies track the transcript instead of lagging a poll cycle behind it.
- Live-call replies are engineered for conversational latency: 2-turn loop cap, 6-line history, 500-token Meta budget, and a two-sentence spoken clamp (section 7), so the wait is one short model call plus first-clause TTS, not a chained agent loop.
- Engine: one Chromium investigation at a time by design in prod; the busy state is surfaced rather than queued silently.
- Portal: server-rendered theme (no flash), viewport-fit layouts with inner-pane scrolling, real-data charts with no decorative series.

## 31. Honesty rules and known limitations

- `analysisSource: heuristic` until a real model call succeeds. Chat and Meet replies carry their model label. Vision failures name the provider and reason.
- Meet has no TURN relay: mesh plus STUN only. Strict corporate NATs can fail; the room says so instead of spinning forever.
- The popped-out Charie widget needs Chrome/Edge (Document Picture-in-Picture) and shows over a screen share only when the entire screen is shared, not a single tab or window. Inside other browsers the widget stays in the room, fully functional. Chrome's own screen-sharing bar is browser UI and follows Chrome's theme; no web page can restyle it, so the room's themed Stop button is the in-product control.
- Screen vision is frame-based, not a video model. Watch mode sees changed frames within seconds; a sub-second transient between changed frames can be missed, and the screen log shows exactly what was captured so the gap is auditable.
- Voice latency target (about 2-3 seconds warm) is a design target, not a guarantee; cold endpoints exceed it and the UI names cold starts.
- Browser speech recognition quality varies by browser; server transcription (Muse Voice) covers voice tickets, not live calls.
- Pentest and sweeps cover scoped, authorized targets with safe checks only. Charie does not claim certification, does not run destructive payloads, and does not take remote control of a customer's machine.
- UX and first-run results are labelled simulations until a human-validation step measures real users.
- Voice cloning is not shipped (section 10). Generated redesigns need `META_API_KEY`. The service-account hardening items in section 25 are open.

## 32. Judging criteria map

| What judges weigh | Where Charie answers it |
|---|---|
| Build for Your World (problem statement) | Built for the world of support engineers and solo builders: joins their live customer calls, sees screens, investigates, verifies, and guards overnight in one loop (README wow moments and founder story) |
| Real problem, real user | Built from 4.5 years of support pain and a solo developer's night-shift risk (README story) |
| Meta model usage, depth not logos | Eight Meta technologies, each at the job it is best at, file-traced in section 21 and [META_STACK.md](META_STACK.md) |
| Open-weight build | Muse Spark Open on Baseten as chat brain, second opinion, and vision lane 2; Muse Glimmer triage; Kokoro voice fallback on Modal |
| Agentic behaviour | Tool-using chat with receipts, consent cards in calls, autopilot schedules, night shift execution with digests, MCP fix packets with proof checks |
| Verification and rigour | Verifier re-runs, before/after diffs, adversarial second model on verdicts, offline-safe test suites (section 28) |
| Honesty | Labelled heuristics, named failures, skipped checks shown as skipped, limitations in section 31 |
| Runs anywhere | Zero-key local loop in five minutes (section 27); prod on Cloud Run with secrets, no `.env` |
| Craft | Verdict-first pages, viewport-fit layouts, one design system (enterprise sans, contrast-checked dark and light themes), command palette, consistent report links |

## 33. Glossary

- **Spine:** the ticket -> evidence -> fix -> proof loop every product shares.
- **Finding:** a typed defect or risk with severity, repro, evidence, cause, fix, and confidence.
- **Work order / fix task:** an approved, executable unit of Guard or Build fix work with proof attached.
- **Night shift:** scheduled autonomous execution of approved work plus sweeps and log watch, summarized in a morning digest.
- **Screen log:** the timestamped list of captured screen descriptions Charie answers history questions from.
- **Watch mode:** change-triggered continuous screen observation in Meet (section 9).
- **Consent card:** an in-call or in-room proposal that runs only after a human approves it.
- **Heuristic mode:** the deterministic built-in analysis used when no model key resolves; always labelled.
- **Second opinion:** Muse Spark Open independently re-grading a finding or challenging a verdict; disagreement lowers confidence or flags review.

## 34. Demo Mode (no-login sample workspace)

Requirement source: the hackathon Demo Mode specification (sample data, zero-login, real Meta models, labelled simulations). Implementation:

- **Entry:** the login page offers "Explore Charie Demo - no login needed". `POST /api/session` with `{demo: true}` mints a normal HMAC session for the reserved uid `demo-workspace` (`apps/portal/lib/demo.ts`). Production authentication is untouched; this is a separate restricted path, not an auth bypass - the session can only ever read and write records owned by the demo uid, which is exactly how per-account scoping already isolates every customer.
- **Seed:** `ensureDemoWorkspace()` runs on demo entry and tops up: it inserts only records whose ids are missing and never overwrites records a demo visitor already has or edited, so workspaces seeded by older builds gain new sample data on the next entry. `buildDemoSeed()` (pure, unit-tested in `apps/portal/test/demo.test.mts`) creates three projects as ticket groups (Demo Site against the real local demo target http://localhost:3101, TravelMate and WorkBoard as labelled simulated targets), 9 tickets with rooms and agent summaries (two tagged `meet:` as on-call tickets from sample calls, one waiting at fix-proposed with a seeded root cause and proposed fix for the approval demo), 5 investigation runs, 2 incidents with `simulated: true`, one simulated GitHub repo (`circle-back/demo-site`) with builds whose detail text says simulated, 4 autopilot schedules, sample Jira and GitHub connectors with a sync rule, 3 context docs (including an uploaded sample brief), a sample chat thread, and 1 ended Meet room with a transcript and screen log. Store additions used: `saveTicket`, `saveRoom`, `clearDemoData` in both adapters.
- **Engine-backed sample fallbacks:** a11y, first-run, pentest, sweep, work-order, digest, signal-cluster, logwatch, and Zoom data lives on the engine per account, outside the portal seed. When the demo account has no real reports, `apps/portal/lib/demo-samples.ts` supplies labelled sample records (every evidence string says Sample) so no demo page renders empty; real engine results always win when present. Seeded demo runs also get sample findings and redesign briefs there when the engine has none. The Night Shift sample digest is substantive content (verified checkout work order, scheduled accessibility fix, grade B security re-scan), not a placeholder line.
- **Demo scan target:** the intentionally buggy demo site is the default target in Demo Mode. The Accessibility, First run, and UX forms are prefilled with it, banners name it, the chat snapshot carries `demo.targetUrl` so "run a sample test" executes live against it (portal also fills a missing scan target for the demo account before the consent card), and an unparseable model reply falls back to the heuristic router instead of a parse dead-end.
- **Executor attribution:** every engine scan report carries an `executor` string, and after each scan the portal shows an auto-appearing tooltip naming who ran it. Accessibility, first-run, and security scans are deterministic Playwright and probe checks, so they name the Charie engine; they are never relabelled as Meta model runs. Where a Meta model did the work, the report names it. The chat footer follows the Baseten/Meta/heuristic picker immediately and shows the actually-served model separately.
- **Seeded reports open with findings:** run ids are `demo-run-*`. The engine serves them from committed fixtures in `services/agent-engine/demo-reports/<runId>/findings.json` plus `report.md` (`reports/` is gitignored, hence the separate folder), via a path-safe fallback in `GET /runs/:id` (`services/agent-engine/src/server.ts`). Fixture content is labelled SAMPLE DEMO DATA and `analysisSource: heuristic`; it never claims a live model produced it. Covered by `services/agent-engine/test/server.test.mts`.
- **Progress is saved:** demo records live in the same store as production data (JSON files under `apps/portal/.data` locally, Firestore hosted), scoped to the demo uid. Anything a judge creates while exploring persists across refresh and restart on that host.
- **Reset:** the demo banner ("DEMO WORKSPACE - Sample data and simulated integrations") carries Reset Demo Workspace, calling `POST /api/demo/reset`, which requires the demo session itself and calls `clearDemoData(DEMO_UID)` then reseeds. It cannot delete any other account's records (both adapters delete strictly by demo uid and its ticket/room/repo children).
- **Simulated integrations:** GitHub in Demo Mode is the seeded repo plus builds, labelled simulated in their own text; there is no demo GitHub OAuth and nothing creates real issues, PRs, or commits. Creating tickets, approvals, chat threads, and Meet rooms in Demo Mode is real - against demo data.
- **Live AI, no fakes:** demo chat, investigations, and vision use the same model lanes as production (section 21). If no live model answers, demo chat replaces a free-form heuristic reply with an explicit "no live model configured" message (`DEMO_AI_OFFLINE` in `apps/portal/lib/charie-chat.ts`); tool-grounded answers over real workspace data still work because they cite records, not model invention. Seeded sample data is labelled sample, never presented as model output.
- **Where keys come from:** the engine resolves secrets environment-first, then Google Cloud Secret Manager with the caller's Application Default Credentials (`services/agent-engine/src/secrets.ts`). On the hosted demo, Cloud Run mounts the owner's secrets, so judges get real Meta model answers with zero setup. On the owner's own machine, `gcloud auth application-default login` plus `GCP_PROJECT_ID` achieves the same. A third-party judge running locally without keys gets the honest unavailable message for AI, while the workspace still browses. Owner keys are never embedded in the repo, the client, or demo data.
- **Known demo limits:** seeded tickets carry seed-week dates; sample scan lists are labelled portal fallbacks until a live run against the demo site replaces them; the simulated TravelMate and WorkBoard targets do not execute - their seeded history is for browsing, and live execution uses the demo site.




