// Bridge between the portal and agent-engine reports on disk, plus spawning
// engine runs as child processes.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import type { FindingView } from "./types";

export const REPO_ROOT = join(process.cwd(), "..", "..");
export const REPORTS_DIR = join(REPO_ROOT, "services", "agent-engine", "reports");

export function listReportDirs(): string[] {
  if (!existsSync(REPORTS_DIR)) return [];
  return readdirSync(REPORTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
}

export function readFindings(runId: string): FindingView[] | null {
  const p = join(REPORTS_DIR, runId, "findings.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as FindingView[];
}

export function readReportMd(runId: string): string | null {
  const p = join(REPORTS_DIR, runId, "report.md");
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

export function readVerification(runId: string): unknown | null {
  const p = join(REPORTS_DIR, runId, "verification.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as unknown;
}

export function readPacket(runId: string, findingId: string): string | null {
  const p = join(REPORTS_DIR, runId, "mcp-packets", `${findingId}.md`);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

/** Serve a report artifact (e.g. screenshots). Null when missing or escaping. */
export function readArtifact(runId: string, rel: string[]): { data: Buffer; type: string } | null {
  const full = normalize(join(REPORTS_DIR, runId, ...rel));
  if (!full.startsWith(join(REPORTS_DIR, runId) + sep)) return null;
  if (!existsSync(full)) return null;
  const ext = full.split(".").pop()?.toLowerCase();
  const type = ext === "png" ? "image/png" : ext === "json" || ext === "md" ? "text/plain; charset=utf-8" : "application/octet-stream";
  return { data: readFileSync(full), type };
}

export function runStatus(runId: string): "running" | "done" | "failed" {
  const dir = join(REPORTS_DIR, runId);
  if (existsSync(join(dir, "findings.json"))) return "done";
  if (existsSync(dir)) return "running";
  return "failed";
}

/** Start an engine run in the background. Resolves fast with the run dir name. */
export function spawnEngineRun(opts: { targetUrl: string; goal: string; verify?: boolean; baseline?: string }): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runId = opts.verify ? `${stamp}-verify` : stamp;
  const args = ["run", "run", "--workspace", "services/agent-engine", "--", "--target", opts.targetUrl, "--goal", opts.goal];
  if (opts.verify && opts.baseline) args.push("--verify", "--baseline", join(REPORTS_DIR, opts.baseline));
  const child = spawn("npm", args, {
    cwd: REPO_ROOT,
    env: { ...process.env, GHOSTQA_RUN_ID: runId },
    detached: process.platform !== "win32",
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  child.unref();
  return runId;
}
