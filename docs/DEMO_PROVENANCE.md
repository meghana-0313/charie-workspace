# Recorded demonstration and provenance pack

The organizers accept recorded demonstrations where judges cannot access the same hardware or external services. This document defines the provenance pack that accompanies the 3-minute video, so every claim in the video can be traced to a real run. Fill it in at recording time - do not backfill numbers afterwards.

## Build and version block (record first)

- Git commit recorded from: `git rev-parse HEAD` output -
- Branch and PR state:
- Host: hosted Cloud Run URL or local (OS, Node version `node -v`):
- Engine mode at record time: models resolved (names only, from engine startup log - never values):
- Demo Mode or production account used:
- Date and time of recording:

## Per-segment provenance (one row per video beat)

Use [DEMO_SCRIPT.md](DEMO_SCRIPT.md) beats. For each beat, capture:

| Field | What to save |
|---|---|
| Beat and timestamp in video | e.g. "Beat 2, 0:45" |
| Input | The exact ticket text, chat message, or spoken question used |
| Model identifier | The label the app itself shows (for example `meta-models/muse-spark-open-1026 (baseten)`, `muse-spark-1.3`, `heuristic`) - screenshot the label, do not retype it from memory |
| Model provider | Baseten, Meta Model API, Ollama (Glimmer), Modal (voice), or none (deterministic) |
| Raw output | The report page, transcript lines, or findings exactly as rendered; export or screenshot before editing |
| Execution record | Run id (`/reports/<kind>/<id>`), engine report folder, or Meet room id |
| Live or simulated | One of: live model call, real Playwright execution, seeded sample data, simulated integration - as labelled in the product |

## Artifacts to keep with the video

- The engine report folders for every run shown (`findings.json`, `report.md`, screenshots, `verification.json` for the verify beat). On Cloud Run these are in the GCS reports bucket; locally under `services/agent-engine/reports/<runId>/`.
- The Meet room transcript export for the call segment, including the screen-log timestamps Charie answered from.
- The chat thread showing receipts for tool actions in the chat segment.
- The morning digest for the night-shift segment (generated from executed records only).
- This file, filled in, plus `git log --oneline -5` output at record time.

## Honesty rules for the recording

- Never re-record a segment with a different result and present it as the first take's output; if a take fails, keep the failure label visible or narrate it.
- Seeded Demo Mode content must be introduced as sample data on camera ("this workspace is seeded; the run I start now is live").
- Simulated GitHub records are called simulated on camera. The real GitHub flow may be shown from production mode only if it actually executes.
- Voice latency shown is the latency recorded; do not speed up call segments.
- If a model lane fails during recording (empty answer, cold start), the fallback label on screen is the provenance - keep it in.

## Where the pack lives

Keep the filled-in pack with the video: a `provenance/` folder in the submission materials (not in this repo if it contains account data), containing this document completed, the artifacts above, and the video file name it belongs to.
