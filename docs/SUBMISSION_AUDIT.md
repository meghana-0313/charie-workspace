# Final submission audit

Requirement source: the organizers' submission-readiness clarification (public repo, no embedded credentials, judges can run it, recorded demonstration accepted where hardware or external services are needed). This audit records what was actually checked, when, and what remains an owner action. Nothing here was published or made public by the audit itself.

Audit date: 2026-11-04. Auditor: Muse Code session on the owner's machine, read-only scans plus documentation changes only.

## Secret scan (the gate before anything goes public)

Method: pattern scan over the tracked tree and over every commit in history (`git grep` across `git rev-list --all`, 133 commits). Only file names and pattern classes were recorded - no candidate values were printed, copied, or stored.

| Check | Result |
|---|---|
| Private key blocks (`BEGIN PRIVATE KEY`) in tree or history | None found |
| GitHub tokens (`ghp_`, `github_pat_`) in tree or history | None found |
| Google API keys (`AIza...`) in tree or history | None found |
| Literal assignments of `META_API_KEY`, `BASETEN_API_KEY`, `ENGINE_TOKEN`, `SESSION_KEY`, `AUTOMATION_KEY`, `CRON_KEY` with real-looking values | None found (code reads them by name from env/Secret Manager only) |
| Credential files ever committed (`.env`, service-account JSON, `.pem`, `credentials.json`) | None. The only historical hit was a placeholder `.env.example`, removed when secrets moved to Secret Manager |
| Service-account JSON on the owner's machine (`project-*.json`) | Present locally, never committed, and now matched by `.gitignore` (`project-*.json`) so it cannot be added by accident |
| `.env` committed | Never. `.env`, `.env.*` are gitignored; `!.env.example` keeps the template committable. Verified with `git check-ignore` |
| Frontend-embedded secrets | None: the portal bundle receives only `FIREBASE_WEB_CONFIG` (public client config) and `NEXT_PUBLIC_VAPID_PUBLIC` (public push key). All model keys stay server-side |

Credential rotation: not required - the scan found no exposed credential to rotate. Standing hygiene items remain from [AGENTS.md](../AGENTS.md): revoke the GitHub PAT after the hackathon and reduce the runtime service account from Owner to least privilege.

## Submission checklist

| Item (organizers' wording) | Status | Evidence |
|---|---|---|
| Public repository access works | PENDING OWNER ACTION | Repo `meghana-0313/charie-workspace` is currently private (verified via API). Make it public only after this audit, on the owner's explicit approval |
| README is complete | Done | Story, one-liner, loops, model lanes, Demo Mode, both judge paths, scope honesty |
| Build instructions are reproducible | Done | README Path B: clone, install, Chromium, env per OS, no DB step locally, demo auto-seeds, tests offline |
| `.env.example` is present | Done | Root [.env.example](../.env.example): every variable the code reads (verified against `secret()` and `process.env` inventories), placeholders only |
| No API keys in source or history | Done | Secret scan above |
| APK contains no confidential credentials | Not applicable | Charie is a web application (portal + engine + demo target). There is no Android APK or installable binary. Distribution is the hosted URL plus this repo; nothing to sign, nothing embedded |
| GitHub Releases contains the intended public build | Not applicable until public | No release published. If a release is cut later, attach only source archives - credentials are never packaged (they are env/Secret Manager resolved at runtime) |
| Judges can enter the demo without logging in | Done | Login page "Explore Charie Demo" (PR #49), isolated `demo-workspace` uid, incognito-safe (fresh session cookie) |
| Sample data is populated | Done | 3 projects, 9 tickets (2 on-call tickets from sample calls, one at fix-proposed with seeded root cause and proposed fix), 5 runs with findings fixtures, 2 simulated incidents, simulated GitHub repo, schedules, sample Meet call; counts verified by probe and tests |
| Meta models perform genuine AI work | Done where keys exist | Chat brain (Baseten Muse Spark Open, then Meta Muse Spark 1.3), vision (Meta first), Spark enrichment, Wonder, Image, SAM, Voice Transcribe, Glimmer - file-traced in [TECHNICAL.md](TECHNICAL.md) section 21. Without keys the product labels heuristic mode and Demo Mode says so plainly instead of faking |
| Recorded evidence has full provenance | Prepared, recording is the owner's | [DEMO_PROVENANCE.md](DEMO_PROVENANCE.md) defines the pack: per-segment model ids, prompts, raw outputs, traces, live-vs-simulated labels, build/version |
| Three-minute video demonstrates the actual project | Owner action | The demo script (kept outside this repo) is the beat sheet; record against the live app or a local run with keys, per the provenance doc |

## Owner approvals still required (nothing below was done by the audit)

1. Make the GitHub repository public (after re-running the secret scan on the final tree).
2. Record and upload the 3-minute video plus the provenance pack.
3. Optionally cut a GitHub Release from `main` (source only).
4. Post-hackathon hygiene: revoke the GitHub PAT, delete the downloaded service-account JSON key, reduce the service account role.

## Re-running the scan before going public

```powershell
git grep -I -l -E 'BEGIN (RSA )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{30,}' -- .
git grep -I -l -E 'BEGIN (RSA )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{30,}' $(git rev-list --all) --
git ls-files | Select-String -Pattern '\.env|credential|\.pem$'
```

All three must print nothing (the third may list `.env.example` and `src/secrets.ts`, which are a template and a resolver, not secrets).
