# AGENTS.md - read this first, every session

GhostQA (`circle-back`): autonomous product-quality engineer for the Meta Global AI
Developer Hackathon 2026. Ticket to verified fix in a closed loop. See README.md
for the product story; this file is working notes for the coding agent.

## Layout

- `apps/portal/` - Next.js dashboard (tickets, rooms, runs, approvals). File store
  locally (`.data/`), Firestore when `PORTAL_STORE=firestore`. Passphrase login
  via middleware + `/api/session`; gate open when `PORTAL_PASSPHRASE` unset.
- `services/agent-engine/` - Playwright loop + HTTP service (`src/serve.ts`, port
  3103). CLI (`src/run-loop.ts`) and server share `src/job.ts`. Reports to
  `./reports/<ts>/`, uploaded to GCS when `GCS_BUCKET` set.
- `services/mcp-server/` - MCP adapter over engine reports. Smoke: `npm run smoke`.
- `apps/demo-target/` - buggy ShopFast store (port 3101) + `--fixed` build.
- `deploy/` - Dockerfiles (portal, engine, demo) for Cloud Run.
- `docs/` - ARCHITECTURE, DEMO_SCRIPT, META_STACK, FIRESTORE_SCHEMA, ROADMAP.

## Golden rules

1. No `.env` file, ever. Secrets resolve env-first then GCP Secret Manager
   (`services/agent-engine/src/secrets.ts`). Never print secret values; log names
   and char counts only.
2. Branch per change, push, open a PR only when asked. Every commit carries a
   `Built-with: Muse Code by Meta` trailer. Never commit the SA JSON or idea txt.
3. Verify before finishing: engine typecheck + `npm test` (34 regression, 13
   server, 4 MCP smoke), portal typecheck + `portal:build` when the portal changed.
4. Fail soft on GCP: missing project/creds/secrets must degrade to heuristic or
   file-backed behavior, never crash. Tests stay offline-safe.
5. Honest labels only: `analysisSource` is `heuristic` until a real model call
   succeeds. Never claim a stub as a live integration.
6. No em-dashes or en-dashes in any repo text (docs, comments, UI strings). Use
   hyphens. Functional `--` CLI flags stay untouched.
7. Many docs are CRLF: use explicit CRLF in multi-line edits or they will not match.

## Commands

- `npm run demo:target` (3101), engine `npm run serve` (3103, needs
  `playwright install chromium`), `npm run portal:dev` (3102, needs `ENGINE_URL`
  only if the engine runs elsewhere).
- `npm test`, `npm run typecheck --workspace services/agent-engine`,
  `npm run typecheck --workspace apps/portal`, `npm run portal:build`.
- Sandbox quirks (this machine): npm needs a writable cache
  (`npm_config_cache` under the runtime temp dir); tsx/Next need `TEMP`/`TMP`
  redirected there too; no listening sockets, so server tests call the handler
  directly; github.com was firewall-blocked until the user allowlisted it.

## GCP prod (project `project-8b9ab843-d0d6-4ea4-a11`, region us-central1)

- Cloud Run: `ghostqa-portal`, `ghostqa-engine` (4Gi/2cpu, concurrency 1,
  3600s timeout), `ghostqa-demo`. Images in `us-central1-docker.pkg.dev/.../ghostqa`.
- Firestore `(default)` in nam5, bucket `<project>-ghostqa`, registry `ghostqa`.
- Secrets (Engine reads directly; portal gets ENGINE_TOKEN/PORTAL_PASSPHRASE/
  SESSION_KEY as mounted env): META_API_KEY, META_API_BASE_URL
  (https://api.meta.ai/v1), META_SPARK/WONDER/IMAGE/VOICE/SAM_MODEL,
  BASETEN_API_KEY, SPARK_OPEN_MODEL_ID/ENDPOINT, GLIMMER_ENDPOINT, ENGINE_TOKEN,
  PORTAL_PASSPHRASE, SESSION_KEY.
- Runtime SA `circle-back-agent` currently has Owner (setup leftover). Harden
  later: Secret Accessor + Firestore User + Storage Object Admin, then delete
  the downloaded JSON key. Revoke the GitHub PAT after the hackathon.
- Billing shows disabled; everything currently runs on free tiers. If a deploy
  starts failing on billing, that step belongs to the user.
- Firebase Auth is NOT enabled (initial provisioning needs one console click).
  Portal auth is passphrase + HMAC sessions until then; keep the auth boundary
  clean so Firebase Auth can drop in.

## Meta model IDs (verified against dev.meta.ai)

- `muse-spark-1.3` (live), `muse-wonder-1.0` (M5), `muse-image-1.0` (M2),
  `muse-voice-transcribe-1.0` (M4), `sam-3-1` (M3), Baseten
  `meta-models/muse-spark-open-1026` at `https://inference.baseten.co/v1` (M7),
  Glimmer 30B Ollama-local default (M6).

## Open items

- Display grounding boxes + redesign images in the portal ticket page (data ships
  in findings.json/briefs.json; no UI yet).
- Custom domain for the portal (needs a user-bought domain + 2 DNS records).
- Harden `circle-back-agent` (drop Owner), delete its JSON key + the PAT.
- Merge PR #4 (prod-cloudrun into dev) then the M2-M7 PR when approved.
