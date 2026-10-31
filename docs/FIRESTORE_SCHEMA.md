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
  findingIds, instruction: string, approvedBy, approvedAt, status

runs/{runId}
  ticketId|roomId, kind: "investigate"|"verify",
  targetUrl, buildId, goal, startedAt, finishedAt, status

runs/{runId}/findings/{findingId}   # see Finding type in ARCHITECTURE.md
  ... + runId, history: [{ status, at, note }]

verifications/{verificationId}
  findingId, beforeRunId, afterRunId, result: "fixed"|"regressed"|"inconclusive",
  diffSummary, createdAt
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
