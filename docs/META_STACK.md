# Meta stack mapping

Every required Meta model/API, the real job it does in GhostQA, and its status.
Rule: **a model counts as "used" only after a real request/inference succeeds -
never from a stub.** Judges can trace each one to a file.

## Hosted - Meta Model API (spend: Meta Model API credits)

| Meta model | Real job in the product | Code | Status |
|---|---|---|---|
| **Muse Spark** (series) | Core investigation reasoning: enriches heuristic findings with cause/fix prose; later, journey planner | `services/agent-engine/src/analyst.ts` via `meta-client.ts` | Wired, needs `META_API_KEY` |
| **Muse Wonder** | Deep-dive tier: multi-file / low-confidence findings escalated from Spark for root-cause + fix proposal | `services/agent-engine/src/wonder.ts` | Interface + selector live; model call pending (M5) |
| **Muse Image** | Evidence-linked UI redesigns: 2-3 alternatives per usability finding + trade-offs + component plan | `services/agent-engine/src/redesign.ts` (in `report.md` + `briefs.json`) | Written-brief fallback live; images pending (M2) |
| **Muse Voice Transcribe** | Voice bug reports → structured tickets (record/attach audio at intake, transcribed to goal + repro) | `apps/portal/` intake + `services/agent-engine/src/voice.ts` | Upload + storage live; transcription pending (M4) |
| **SAM 3.1** | Screenshot grounding: segments cited UI controls → bounding boxes on failure screenshots, before/after diff regions | `services/agent-engine/src/grounding.ts` | Interface live, whole-shot fallback; model pending (M3) |

## Open weights (spend: Baseten / Modal credits - NOT interchangeable with Model API credits)

| Meta model | Real job in the product | Runtime | Status |
|---|---|---|---|
| **Muse Spark Open** (`meta-models/muse-spark-open-1026`) | Second-opinion analyst: independently re-grades Spark findings; disagreement lowers confidence | Hosted open-weight endpoint (e.g. Baseten) | Planned (M7) |
| **Muse Glimmer** | Lightweight triage: ticket → goal extraction, severity pre-grade, finding dedup | Baseten or Modal; local only if laptop VRAM checks out | Heuristic live (`triage.ts`, wired to portal); model pending (M6) |

> No giant weight downloads on the Windows laptop without a hardware check first.
> Open-weight integrations are provider-endpoint-first.

## Coding agent

| Tool | Real job | Status |
|---|---|---|
| **Muse Code** | Built this repo; at runtime, consumes MCP fix packets (`mcp-packets/*.md` → `services/mcp-server/`) and returns fixes for verification | Packets live; server planned (M8) |

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
GLIMMER_ENDPOINT             # (M6; Ollama-local default, hosted endpoint optional)
BASETEN_API_KEY              # Baseten Model API key (open weights)
MODAL_CREDENTIALS            # (backup for open weights)
```

Local access needs the Secret Manager Secret Accessor role
(`roles/secretmanager.secretAccessor`) on the calling identity.

## Milestones (vertical slice first, then incremental)

- **M0 DONE:** buggy demo-target + explore→analyze→report→verify loop, heuristic mode.
- **M1:** Spark live (key + endpoint confirm; first real inference).
- **M2:** Image redesigns in the report. **M3:** SAM grounding boxes. **M4:** voice tickets.
- **M5:** Wonder deep-dive escalation. **M6:** Glimmer triage. **M7:** Spark Open second opinion.
- **M8:** Portal rooms + MCP server serving findings to Muse Code.

## Why this mapping wins points

- Eight Meta technologies, each doing the job it's best at - no disconnected demo buttons.
- Every call degrades gracefully, so the demo never dies on a network/API failure.
- GhostQA *feeds* Muse Code instead of competing with it - a Meta-ecosystem story.
