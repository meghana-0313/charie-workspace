# GhostQA MCP server

Stdio MCP server that hands investigation evidence to a coding agent (Muse Code, …).
Tools: `list_runs`, `list_findings`, `get_finding`, `get_verification`.

## Run

```bash
npm install --workspace services/mcp-server
npm run start --workspace services/mcp-server
# reads GHOSTQA_REPORTS or ../agent-engine/reports
```

## Coding-agent config (example)

```json
{
  "mcpServers": {
    "ghostqa": {
      "command": "npm",
      "args": ["run", "start", "--workspace", "services/mcp-server"],
      "cwd": "C:/Users/megha/circle-back",
      "env": { "GHOSTQA_REPORTS": "C:/Users/megha/circle-back/services/agent-engine/reports" }
    }
  }
}
```

## Smoke test

```bash
npm run smoke --workspace services/mcp-server
```

Speaks real JSON-RPC over stdio against `fixtures/sample-run` (a committed,
labeled fixture - not a live investigation).

## Typical agent flow

1. `list_runs` → pick the newest run.
2. `list_findings` → pick a blocker.
3. `get_finding` → repro + fix packet → implement the fix in a branch.
4. GhostQA verifier re-runs the journey; `get_verification` proves fixed/still-open.
