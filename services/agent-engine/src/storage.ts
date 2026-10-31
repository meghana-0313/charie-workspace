// Report artifacts <-> Cloud Storage. Fail-soft everywhere: without GCS_BUCKET
// configured or without credentials, uploads/downloads are skipped with a
// warning and local runs are unaffected.

import { Storage } from "@google-cloud/storage";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join, normalize, relative, sep } from "node:path";

let storage: Storage | null = null;

function bucketName(): string | undefined {
  return process.env.GCS_BUCKET ?? undefined;
}

function client(): Storage {
  storage ??= new Storage();
  return storage;
}

async function filesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await filesRecursive(full)));
    else out.push(full);
  }
  return out;
}

/** Upload a finished report dir to gs://<bucket>/runs/<runId>/. Never throws. */
export async function uploadRun(outDir: string): Promise<void> {
  const bucket = bucketName();
  if (!bucket) return;
  const runId = outDir.split(sep).pop() ?? "unknown";
  try {
    const b = client().bucket(bucket);
    for (const f of await filesRecursive(outDir)) {
      await b.upload(f, { destination: `runs/${runId}/${relative(outDir, f).split(sep).join("/")}` });
    }
    console.log(`[storage] uploaded run ${runId} to gs://${bucket}/runs/${runId}/`);
  } catch (e) {
    console.warn(`[storage] upload skipped: ${(e as Error).message}`);
  }
}

/**
 * Fetch a voice-note blob (e.g. "uploads/uid-file") for transcription.
 * GCS when GCS_BUCKET is set, else the portal's local .data dir
 * (PORTAL_DATA_DIR overrides the default relative path). Null when missing.
 */
export async function fetchVoiceNote(rel: string): Promise<Buffer | null> {
  if (!rel || rel.includes("..")) return null;
  const bucket = bucketName();
  if (bucket) {
    try {
      const [data] = await client().bucket(bucket).file(rel).download();
      return data;
    } catch {
      return null;
    }
  }
  const base = process.env.PORTAL_DATA_DIR ?? join(process.cwd(), "..", "..", "apps", "portal", ".data");
  const full = normalize(join(base, ...rel.split("/")));
  if (!full.startsWith(base + sep) || !existsSync(full)) return null;
  return readFileSync(full);
}

/**
 * Make sure a baseline's findings.json exists locally, fetching from GCS when
 * this instance never saw that run (multi-instance Cloud Run). Never throws.
 */
export async function ensureBaselineLocal(reportsRoot: string, baselineRunId: string): Promise<void> {
  if (existsSync(join(reportsRoot, baselineRunId, "findings.json"))) return;
  const bucket = bucketName();
  if (!bucket) return;
  try {
    await mkdir(join(reportsRoot, baselineRunId), { recursive: true });
    await client()
      .bucket(bucket)
      .file(`runs/${baselineRunId}/findings.json`)
      .download({ destination: join(reportsRoot, baselineRunId, "findings.json") });
    console.log(`[storage] fetched baseline ${baselineRunId} from GCS`);
  } catch (e) {
    console.warn(`[storage] baseline fetch skipped: ${(e as Error).message}`);
  }
}
