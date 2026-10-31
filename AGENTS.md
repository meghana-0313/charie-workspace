# AGENTS.md - read this first, every session

Charie (`charie-workspace`, formerly `circle-back`): autonomous engineering
intelligence for the Meta Global AI Developer Hackathon 2026. Product family:
Charie Build (QA/testing/debugging/engineering), Charie Guard (runtime security
and threat response), Charie Ops (production intelligence and reliability).
See README.md for the product story; this file is working notes for the agent.

## Layout

- `apps/portal/` - Next.js workspace (tickets, rooms, scans, meet, guard, ops).
  File store locally (`.data/`), Firestore when `PORTAL_STORE=firestore`.
  Firebase Google login via `/api/session` (ID token verify) + HMAC session
  cookie `charie_session`; always-on middleware gate; local-owner dev login +
  AUTOMATION_KEY fallback. Per-account data via `uid` scoping.
- `services/agent-engine/` - Playwright loop + HTTP service (`src/serve.ts`, port
  3103). CLI (`src/run-loop.ts`) and server share `src/job.ts`. Reports to
  `./reports/<ts>/`, uploaded to GCS when `GCS_BUCKET` set. New checks:
  `src/a11y.ts` (POST /a11y/run), `src/firstrun.ts` (POST /firstrun/run).
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
3. Verify before finishing: engine typecheck + `npm test` (62 regression, 46
   server, 37 guardian-plus, 15 access), portal typecheck + `portal:build` when
   the portal changed.
4. Fail soft on GCP: missing project/creds/secrets must degrade to heuristic or
   file-backed behavior, never crash. Tests stay offline-safe.
5. Honest labels only: `analysisSource` is `heuristic` until a real model call
   succeeds. Never claim a stub as a live integration.
6. No em-dashes or en-dashes in any repo text (docs, comments, UI strings). Use
   hyphens. Functional `--` CLI flags stay untouched.
7. Env vars are `CHARIE_RUN_ID` / `CHARIE_REPORTS` (renamed from GHOSTQA_*).
   Historic names that stay: GCS bucket `<project>-ghostqa`, service account
   `circle-back-agent`, npm scope `@circle-back/*` (lockfile stability).

## Commands

- `npm run demo:target` (3101), engine `npm run serve` (3103, needs
  `playwright install chromium`), `npm run portal:dev` (3102, needs `ENGINE_URL`
  only if the engine runs elsewhere).
- `npm test`, `npm run typecheck --workspace services/agent-engine`,
  `npm run typecheck --workspace apps/portal`, `npm run portal:build`.
- Sandbox quirks (this machine): npm needs a writable cache
  (`npm_config_cache` under the runtime temp dir); tsx/Next need `TEMP`/`TMP`
  redirected there too; no listening sockets, so server tests call the handler
  directly; PowerShell here is old and case-insensitive: never bulk `-replace`
  for renames (it mangles case), use node scripts with exact splits.

## GCP prod (project `project-8b9ab843-d0d6-4ea4-a11`, region us-central1)

- Cloud Run: `charie-portal`, `charie-engine` (4Gi/2cpu, concurrency 1,
  3600s timeout), `charie-demo`. Images in
  `us-central1-docker.pkg.dev/.../charie`. Preview: `charie-preview`.
- Firestore `(default)` in nam5, bucket `<project>-ghostqa` (historic name kept),
  registry `charie`.
- Secrets (Engine reads directly; portal gets ENGINE_TOKEN/FIREBASE_WEB_CONFIG/
  AUTOMATION_KEY/SESSION_KEY as mounted env): META_API_KEY, META_API_BASE_URL
  (https://api.meta.ai/v1), META_SPARK/WONDER/IMAGE/VOICE/SAM_MODEL,
  BASETEN_API_KEY, SPARK_OPEN_MODEL_ID/ENDPOINT, GLIMMER_ENDPOINT, ENGINE_TOKEN,
  FIREBASE_WEB_CONFIG, AUTOMATION_KEY, CRON_KEY, SESSION_KEY.
- Runtime SA `circle-back-agent` currently has Owner (setup leftover). Harden
  later: Secret Accessor + Firestore User + Storage Object Admin, then delete
  the downloaded JSON key. Revoke the GitHub PAT after the hackathon.
- Billing shows disabled; everything currently runs on free tiers. If a deploy
  starts failing on billing, that step belongs to the user.
- CI: every push to dev runs `.github/workflows/deploy.yml` (test, build, roll
  all three services) via Workload Identity Federation. No stored GCP keys.
- Firebase Auth is wired (Google provider). The one-time console click
  (Authentication > Get started > enable Google) belongs to the user; the
  login page shows the exact step until it is done.

## Meta model IDs (verified against dev.meta.ai)

- `muse-spark-1.3` (live), `muse-wonder-1.0` (M5), `muse-image-1.0` (M2),
  `muse-voice-transcribe-1.0` (M4), `sam-3-1` (M3), Baseten
  `meta-models/muse-spark-open-1026` at `https://inference.baseten.co/v1` (M7),
  Glimmer 30B Ollama-local default (M6).

## Open items

- Custom domain for the portal (needs a user-bought domain + 2 DNS records).
- Harden `circle-back-agent` (drop Owner), delete its JSON key + the PAT.
- TURN relay for Meet rooms behind strict NATs (mesh + STUN today).
- Delete legacy `ghostqa-*` Cloud Run services and the `ghostqa` image repo
  after the Charie cutover verifies.
