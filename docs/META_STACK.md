# Meta stack mapping

Every required Meta model/API, the real job it does in GhostQA, and its status.
Rule: **a model counts as "used" only after a real request/inference succeeds —
never from a stub.** Judges can trace each one to a file.

## Hosted — Meta Model API (spend: Meta Model API credits)

| Meta model | Real job in the product | Code | Status |
|---|---|---|---|
| **Muse Spark** (series) | Core investigation reasoning: enriches heuristic findings with cause/fix prose; later, journey planner | `services/agent-engine/src/analyst.ts` via `meta-client.ts` | Wired, needs `META_API_KEY` |
| **Muse Wonder** | Deep-dive tier: multi-file / low-confidence findings escalated from Spark for root-cause + fix proposal | `services/agent-engine/src/wonder.ts` | Interface + selector live; model call pending (M5) |
| **Muse Image** | Evidence-linked UI redesigns: 2–3 alternatives per usability finding + trade-offs + component plan | `services/agent-engine/src/redesign.ts` (in `report.md` + `briefs.json`) | Written-brief fallback live; images pending (M2) |
| **Muse Voice Transcribe** | Voice bug reports → structured tickets (record/attach audio at intake, transcribed to goal + repro) | `apps/portal/` intake + `services/agent-engine/src/voice.ts` | Upload + storage live; transcription pending (M4) |
| **SAM 3.1** | Screenshot grounding: segments cited UI controls → bounding boxes on failure screenshots, before/after diff regions | `services/agent-engine/src/grounding.ts` | Interface live, whole-shot fallback; model pending (M3) |

## Open weights (spend: Baseten / Modal credits — NOT interchangeable with Model API credits)

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

`services/agent-engine/.env` (see `.env.example`). Secrets only ever come from env:

```bash
META_API_KEY=...                 # hackathon Model API credits (hosted five)
META_API_BASE_URL=...            # from dev.meta.ai docs / hackathon starter
META_SPARK_MODEL=...             # exact Muse Spark series id from docs
META_WONDER_MODEL=...            # exact Muse Wonder id from docs
META_IMAGE_MODEL=...             # exact Muse Image id from docs
META_VOICE_MODEL=...             # exact Muse Voice Transcribe id from docs
META_SAM_MODEL=...               # exact SAM 3.1 id from docs
SPARK_OPEN_MODEL_ID=meta-models/muse-spark-open-1026
SPARK_OPEN_ENDPOINT=...          # Baseten/hosted open-weight endpoint
GLIMMER_ENDPOINT=...             # Baseten/Modal endpoint for Muse Glimmer
BASETEN_API_KEY=...              # Baseten credits (open weights)
MODAL_CREDENTIALS=...            # Modal compute credits (open weights)
```

## Milestones (vertical slice first, then incremental)

- **M0 DONE:** buggy demo-target + explore→analyze→report→verify loop, heuristic mode.
- **M1:** Spark live (key + endpoint confirm; first real inference).
- **M2:** Image redesigns in the report. **M3:** SAM grounding boxes. **M4:** voice tickets.
- **M5:** Wonder deep-dive escalation. **M6:** Glimmer triage. **M7:** Spark Open second opinion.
- **M8:** Portal rooms + MCP server serving findings to Muse Code.

## Why this mapping wins points

- Eight Meta technologies, each doing the job it's best at — no disconnected demo buttons.
- Every call degrades gracefully, so the demo never dies on a network/API failure.
- GhostQA *feeds* Muse Code instead of competing with it — a Meta-ecosystem story.
