# Firestore schema (live)

Database: **Cloud Firestore** (Firebase) in production. The portal store
(`apps/portal/lib/store.ts`) picks Firestore when `PORTAL_STORE=firestore` and a
local JSON file store otherwise; both implement the same interface, so judges
running locally get identical behavior with zero cloud setup. Every record
carries a `uid` (the owning Firebase account) and every read is scoped to the
signed in account; legacy records without a `uid` stay shared.

## Collections

```text
tickets/{ticketId}
  uid, subject, body,
  status: "new"|"investigating"|"in-room"|"fix-proposed"|"verified"|"closed",
  goal: string,                 # extracted user task ("buy 3 items and check out")
  targetUrl, voiceNotePath?,
  sourceRepo?,                  # owner/repo, or "meet:<roomId>" for tickets filed
                                # from a live call (drives the On-call section)
  roomId?, createdAt, updatedAt

rooms/{roomId}                  # 1:1 with significant tickets
  ticketId, title, status, createdAt

rooms/{roomId}/messages/{msgId}
  author: { type: "human"|"agent", name },
  body, findingIds: string[], createdAt

rooms/{roomId}/approvals/{approvalId}
  findingIds, instruction: string, approvedBy, approvedAt,
  status: "approved"|"sent-to-agent"

guardian-events/{eventId}
  ts, kind: "auth"|"api"|"traffic"|"infra",
  actor?, ip?, endpoint?, outcome?, country?, bytes?, records?

incidents/{incidentId}          # Runtime Guardian; simulated: true always
  title, severity, status: "open"|"contained"|"resolved",
  signals[], investigation?, mode, baselineSuspicious,
  voiceBrief?, actions[], createdAt, updatedAt

push_subscriptions/{sha256(endpoint)}
  endpoint, keys: { p256dh, auth }, createdAt

repos/{repoId}               # Connected GitHub repos
  owner, repo, branch, subdir, startCommand,
  visibility: "public"|"private", hasToken, token?,
  status: "connected"|"building"|"live"|"failed",
  lastSha?, appUrl?, ticketId?, createdAt, updatedAt

builds/{buildId}             # Repo Cloud Builds (query by repoId, sort in code)
  repoId, sha, cloudBuildId, strategy: "dockerfile"|"node"|"python",
  status: "queued"|"working"|"success"|"failure"|"deployed"|"error",
  appUrl?, ticketId?, detail?, createdAt, updatedAt

runs/{runId}
  ticketId|roomId, kind: "investigate"|"verify",
  targetUrl, buildId, goal, startedAt, finishedAt, status

runs/{runId}/findings/{findingId}   # see Finding type in ARCHITECTURE.md
  ... + runId, history: [{ status, at, note }]

verifications/{verificationId}
  findingId, beforeRunId, afterRunId, result: "fixed"|"regressed"|"inconclusive",
  diffSummary, createdAt

meet_rooms/{roomId}            # Charie Meet native video rooms
  uid (owner account), title, createdBy, liveNotes?: bool (opt-in live
  transcription), seq: number (last signal), createdAt, updatedAt

meet_rooms/{roomId}/signals/{seq}   # WebRTC signaling, polled, pruned to 200
  seq, roomId, from, to ("*" = broadcast),
  kind: "join"|"leave"|"offer"|"answer"|"candidate",
  payload (SDP/ICE JSON, "" for join/leave), createdAt

meet_checkins/{roomId}         # Guest consent check-ins (one per room visit)
  roomId, name, ticketId, transcribe?: bool (guest opted into transcription),
  at. Only name + issue are kept; media is never stored.

team_seats/{seatId}            # Team access, keyed to Firebase sign-in
  email (invite match), name?, role: "admin"|"member",
  owner?: bool (first seat bootstraps as owner),
  uid?: string (linked Firebase uid after first login),
  createdAt, lastLoginAt?. The first verified sign-in becomes owner.

api_keys/{keyId}               # Prod app ingest keys (hashes only)
  uid (owner account), prefix, name, salt, hash (scrypt of secret part),
  createdAt, lastUsedAt?, revoked: bool. Secrets look like chp_<prefix>_<secret>
  and double as the Bearer token for the MCP endpoint (POST /api/mcp).

schedules/{scheduleId}         # Autopilot schedules
  uid, kind, preset, target?, enabled, lastRunAt?, lastStatus?,
  createdAt, updatedAt

chat_threads/{threadId}        # Chat with Charie threads
  uid, title, messages[], createdAt, updatedAt

connectors/{connectorId}       # Marketplace connectors
  uid, kind: "github"|"jira"|"webhook-in", name, status, detail?,
  config (jira tokens are server only, never serialized to clients)

sync_rules/{ruleId}            # Jira pull rules
  uid, connectorId, kind: "jira-pull", jql?, project?, targetUrl, preset,
  enabled, importedKeys?

context_docs/{docId}           # Context for Charie
  uid, title, source: "note"|"url", body?, url?, createdAt, updatedAt

github_tokens/{uid}            # GitHub OAuth token per account (server only)
  uid, token, login?, createdAt, updatedAt

settings/{key}                 # Workspace settings
  value, updatedAt             # prodProjectId for log watch
```

## Storage layout (Firebase Storage)

```text
runs/{runId}/screenshots/*.png
runs/{runId}/trace.json
runs/{runId}/report.md
runs/{runId}/redesigns/*.png
```

## Security posture

- The browser never talks to Firestore directly. The portal (Cloud Run) uses
  the Admin SDK server side; middleware requires a signed session cookie for
  every page and API except the login flow, guest invite check-in, and the key
  authenticated ingest and MCP endpoints.
- Per-account scoping: every list and read filters by the caller's `uid`
  (see `scopeUid` in `apps/portal/lib/who.ts`). Engine Guardian data is
  partitioned the same way via the `x-charie-account` header.
- Guest Meet access is a signed, expiring, room-scoped invite token plus a
  recorded consent check-in. Transcripts live in call memory only and are
  persisted solely when the team presses Save.
- Webhook and ingest secrets are stored as hashes; raw tokens (GitHub,
  Jira) stay server side and are never serialized to clients.
