// Bridge between the portal and the engine HTTP service.
// Local dev: ENGINE_URL=http://localhost:3103 (engine `npm run serve`).
// Prod: the Cloud Run engine URL + ENGINE_TOKEN (secret mount).

import type { FindingView } from "./types";

function base(): string {
  return (process.env.ENGINE_URL ?? "http://localhost:3103").replace(/\/$/, "");
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (process.env.ENGINE_TOKEN) h["x-engine-token"] = process.env.ENGINE_TOKEN;
  return h;
}

interface RunState {
  status: "running" | "done" | "failed";
  findings?: FindingView[];
  verification?: unknown;
  report?: string;
  error?: string;
}

async function runState(runId: string): Promise<RunState | null> {
  const res = await fetch(`${base()}/runs/${encodeURIComponent(runId)}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`engine run read failed: ${res.status}`);
  return (await res.json()) as RunState;
}

/** Start an engine run. Resolves fast with the run id. */
export async function spawnEngineRun(opts: { targetUrl: string; goal: string; verify?: boolean; baseline?: string }): Promise<string> {
  const res = await fetch(`${base()}/runs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      targetUrl: opts.targetUrl,
      goal: opts.goal,
      verify: opts.verify === true,
      baselineRunId: opts.baseline,
    }),
  });
  if (!res.ok) throw new Error(`engine rejected run (${res.status})`);
  return ((await res.json()) as { runId: string }).runId;
}

export async function runStatus(runId: string): Promise<"running" | "done" | "failed"> {
  try {
    return (await runState(runId))?.status ?? "failed";
  } catch {
    return "running"; // transport blip - keep polling rather than fail the run
  }
}

export async function readFindings(runId: string): Promise<FindingView[] | null> {
  const s = await runState(runId).catch(() => null);
  return s?.findings ?? null;
}

export async function readReportMd(runId: string): Promise<string | null> {
  const s = await runState(runId).catch(() => null);
  return s?.report ?? null;
}

export async function readVerification(runId: string): Promise<unknown | null> {
  const s = await runState(runId).catch(() => null);
  return s?.verification ?? null;
}

export async function readPacket(runId: string, findingId: string): Promise<string | null> {
  const f = await readArtifact(runId, ["mcp-packets", `${findingId}.md`]);
  return f ? f.data.toString("utf8") : null;
}

/** Fetch a report artifact (e.g. screenshots). Null when missing. */
export async function readArtifact(runId: string, rel: string[]): Promise<{ data: Buffer; type: string } | null> {
  const res = await fetch(
    `${base()}/runs/${encodeURIComponent(runId)}/artifacts/${rel.map(encodeURIComponent).join("/")}`,
    { headers: headers(), cache: "no-store" },
  ).catch(() => null);
  if (!res || !res.ok) return null;
  return {
    data: Buffer.from(await res.arrayBuffer()),
    type: res.headers.get("content-type") ?? "application/octet-stream",
  };
}
