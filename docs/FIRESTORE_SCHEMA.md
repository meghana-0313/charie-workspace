# Firestore schema (planned - portal milestone)

Database choice: **Cloud Firestore** (Firebase). Rationale: real-time rooms,
generous free tier, Auth + Storage in one console, fastest to a working portal in
the hackathon window. All collections work identically if we later move to
self-hosted Postgres - access goes through a repository layer, never raw queries
in components.

## Collections

```text
tickets/{ticketId}
  customerName, subject, body, source: "portal"|"email"|"call-sim",
  status: "new"|"investigating"|"in-room"|"fix-proposed"|"verified"|"closed",
  goal: string,                 # extracted user task ("buy 3 items and check out")
  targetUrl, buildId,
  createdAt, updatedAt

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
  title, createdBy, seq: number (last signal), createdAt, updatedAt

meet_rooms/{roomId}/signals/{seq}   # WebRTC signaling, polled, pruned to 200
  seq, roomId, from, to ("*" = broadcast),
  kind: "join"|"leave"|"offer"|"answer"|"candidate",
  payload (SDP/ICE JSON, "" for join/leave), createdAt

team_seats/{seatId}            # Named teammate logins
  name, nameLower, role: "admin"|"member",
  salt, passHash (scrypt), createdAt, lastLoginAt?

api_keys/{keyId}               # Prod app ingest keys (hashes only)
  prefix, name, salt, hash (scrypt of secret part),
  createdAt, lastUsedAt?, revoked: bool

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

## Security rules posture (portal milestone)

- Auth required for all reads/writes; rooms scoped to team members.
- Agent writes via Admin SDK with `author.type == "agent"`; humans can't forge agent messages.
- Ticket PII fields excluded from model prompts (redaction before `analyst.ts`).
