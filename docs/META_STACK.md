# Meta stack mapping

Every required Meta model/API, the real job it does in GhostQA, and its status.
Rule: **a model counts as "used" only after a real request/inference succeeds -
never from a stub.** Judges can trace each one to a file.

## Hosted - Meta Model API (spend: Meta Model API credits)

| Meta model | Real job in the product | Code | Status |
|---|---|---|---|
| **Muse Spark** (series) | Core investigation reasoning: enriches heuristic findings with cause/fix prose; later, journey planner | `services/agent-engine/src/analyst.ts` via `meta-client.ts` | Live with `META_API_KEY` (key verified 200); heuristic fallback |
| **Muse Wonder** | Deep-dive tier: multi-file / low-confidence findings escalated from Spark for root-cause + fix proposal | `services/agent-engine/src/wonder.ts` | Live: deep dives replace low-confidence prose (M5) |
| **Muse Image** | Evidence-linked UI redesigns: 2-3 alternatives per usability finding + trade-offs + component plan | `services/agent-engine/src/redesign.ts` (in `report.md` + `briefs.json`) | Live: PNGs in `redesigns/` + briefs.json, first 2 usability findings (M2) |
| **Muse Voice Transcribe** | Voice bug reports → structured tickets (record/attach audio at intake, transcribed to goal + repro) | `apps/portal/` intake + `services/agent-engine/src/voice.ts` + engine `/transcribe` | Live: voice-first tickets (M4) |
| **SAM 3.1** | Screenshot grounding: segments cited UI controls → bounding boxes on failure screenshots, before/after diff regions | `services/agent-engine/src/grounding.ts` | Live: boxes in `findings[].grounding`, whole-shot fallback (M3) |

## Open weights (spend: Baseten / Modal credits - NOT interchangeable with Model API credits)

| Meta model | Real job in the product | Runtime | Status |
|---|---|---|---|
| **Muse Spark Open** (`meta-models/muse-spark-open-1026`) | Second-opinion analyst: independently re-grades Spark findings; disagreement lowers confidence | Baseten Model API (`src/baseten.ts`) | Live (slug verified 200); disagreement lowers confidence (M7) |
| **Muse Glimmer** | Lightweight triage: ticket → goal extraction, severity pre-grade, finding dedup | Ollama-local default (`muse-glimmer:30b`), any OpenAI-compatible endpoint | Live when reachable via engine `/triage`, heuristic fallback (M6) |

> No giant weight downloads on the Windows laptop without a hardware check first.
> Open-weight integrations are provider-endpoint-first.

## Coding agent

| Tool | Real job | Status |
|---|---|---|
| **Muse Code** | Built this repo; at runtime, consumes MCP fix packets (`mcp-packets/*.md` → `services/mcp-server/`) and returns fixes for verification | Packets + stdio server live, 4/4 smoke (M8) |

## Configuration

No `.env` file: at startup the engine pulls secrets from Google Cloud Secret
Manager (`versions/latest`, secret IDs below verbatim) into memory, using
Application Default Credentials - the attached service account on GCP, or
`gcloud auth application-default login` locally. `GCP_PROJECT_ID` selects the
project (`GOOGLE_CLOUD_PROJECT` also works). Anything already set in the
environment wins (tests, Cloud Run-mounted secrets); anything missing just
leaves that model in heuristic mode.

Secret IDs in Secret Manager (values from the dev.meta.ai and Baseten dashboards):

```bash
META_API_KEY                 # Model API key (unlocks all five hosted models)
META_API_BASE_URL            # https://api.meta.ai/v1
META_SPARK_MODEL             # muse-spark-1.3
META_WONDER_MODEL            # muse-wonder-1.0
META_IMAGE_MODEL             # muse-image-1.0
META_VOICE_MODEL             # muse-voice-transcribe-1.0
META_SAM_MODEL               # sam-3-1
SPARK_OPEN_MODEL_ID          # meta-models/muse-spark-open-1026
SPARK_OPEN_ENDPOINT          # https://inference.baseten.co/v1
GLIMMER_ENDPOINT             # default http://localhost:11434/v1 (Ollama)
GLIMMER_MODEL                # default muse-glimmer:30b
GLIMMER_API_KEY              # only for hosted endpoints (omit for Ollama)
BASETEN_API_KEY              # Baseten Model API key (open weights)
MODAL_CREDENTIALS            # (backup for open weights)
```

Local access needs the Secret Manager Secret Accessor role
(`roles/secretmanager.secretAccessor`) on the calling identity.

## Runtime Guardian (post-deploy, simulated environment)

| Meta model | Guardian job |
|---|---|
| Muse Spark | Main incident investigation: verdict, timeline, response plan |
| Muse Spark Open | Adversarial challenge of the verdict; disagreement flags human review |
| Muse Glimmer | Pre-filters noise signals before investigation (fail-open) |
| Muse Wonder | Deep response planning for blocker incidents |

Detectors are deterministic rules over event windows (stuffing, takeover, API
abuse, exfiltration); models interpret and explain, never gate detection alone.

## Milestones (vertical slice first, then incremental)

- **M0 DONE:** buggy demo-target + explore→analyze→report→verify loop, heuristic mode.
- **M1 DONE:** Spark live (key verified 200; first real inference in prod).
- **M2 DONE:** Image redesigns in the report. **M3 DONE:** SAM grounding boxes. **M4 DONE:** voice tickets.
- **M5 DONE:** Wonder deep-dive escalation. **M6 DONE:** Glimmer triage. **M7 DONE:** Spark Open second opinion.
- **M8 DONE:** Portal rooms + MCP server serving findings to Muse Code.

## Why this mapping wins points

- Eight Meta technologies, each doing the job it's best at - no disconnected demo buttons.
- Every call degrades gracefully, so the demo never dies on a network/API failure.
- GhostQA *feeds* Muse Code instead of competing with it - a Meta-ecosystem story.
