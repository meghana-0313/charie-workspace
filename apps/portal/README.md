# Charie portal

Tickets → rooms → runs → evidence → approved fix instructions. Local-first:
JSON-file store now, Firestore + Firebase Auth plug in at the end (types already
mirror `docs/FIRESTORE_SCHEMA.md`).

## Run

```bash
npm install --workspace apps/portal
npm run dev --workspace apps/portal
# → http://localhost:3102
```

The demo flow needs the buggy store too: `npm run demo:target` (port 3101).

## End-to-end loop

1. File a ticket (goal + target URL, optional voice note stored for M4).
2. Room opens; press **Run investigation** (spawns the agent-engine in background).
3. Refresh: findings with repro steps, screenshots, severity, fix packets.
4. Discuss in the room; press **Approve fix instruction** per finding.
5. Fix the app (or flip demo-target to `--fixed`), press **Verify fix**.
6. Verification diff lands in the room; ticket flips to `verified`.

Coding agents can read the same runs via `services/mcp-server`.
Data lives in `apps/portal/.data` (gitignored).
