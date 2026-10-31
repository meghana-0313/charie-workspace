// Secret resolution: process.env first, Google Cloud Secret Manager second.
// There is deliberately no .env file: secret values live only in Secret
// Manager (versions/latest) and are cached in memory after loadSecrets().
//
// Auth is ADC (no key files): the attached service account on GCP, or
// `gcloud auth application-default login` locally. The GCP project comes
// from GCP_PROJECT_ID (GOOGLE_CLOUD_PROJECT also works — Cloud Run sets it).
// Everything fails soft: no project / no credentials / no secret just means
// that value stays undefined and the engine keeps running in heuristic mode.

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

/** Every secret the engine may read from Secret Manager (secret IDs verbatim). */
export const SECRET_NAMES = [
  "META_API_KEY",
  "META_API_BASE_URL",
  "META_SPARK_MODEL",
  "META_WONDER_MODEL",
  "META_IMAGE_MODEL",
  "META_VOICE_MODEL",
  "META_SAM_MODEL",
  "BASETEN_API_KEY",
  "SPARK_OPEN_MODEL_ID",
  "SPARK_OPEN_ENDPOINT",
  "GLIMMER_ENDPOINT",
  "ENGINE_TOKEN",
] as const;

const cache = new Map<string, string>();
let client: SecretManagerServiceClient | null = null;

function projectId(): string | undefined {
  return process.env.GCP_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? undefined;
}

/** Sync read: env wins (tests, Cloud Run-mounted secrets), then the GCP cache. Never networks. */
export function secret(name: string): string | undefined {
  return process.env[name] ?? cache.get(name);
}

/** Test seam: drop everything pulled from GCP. */
export function _clearSecretCache(): void {
  cache.clear();
}

export interface LoadResult {
  loaded: string[];
  missing: string[];
}

/**
 * Pull names missing from env out of Secret Manager into the memory cache.
 * Never throws and never prints values — callers log names/counts only.
 */
export async function loadSecrets(names: readonly string[] = SECRET_NAMES): Promise<LoadResult> {
  const loaded: string[] = [];
  const missing: string[] = [];
  const pending = names.filter((n) => process.env[n] === undefined && !cache.has(n));
  if (pending.length === 0) return { loaded, missing };

  const project = projectId();
  if (!project) {
    console.warn("[secrets] GCP_PROJECT_ID not set — Secret Manager skipped (env-only mode)");
    missing.push(...pending);
    return { loaded, missing };
  }

  let svc: SecretManagerServiceClient;
  try {
    client ??= new SecretManagerServiceClient();
    svc = client;
  } catch (e) {
    console.warn(`[secrets] Secret Manager client failed (${(e as Error).message}) — continuing without GCP secrets`);
    missing.push(...pending);
    return { loaded, missing };
  }

  await Promise.all(
    pending.map(async (name) => {
      try {
        const [version] = await svc.accessSecretVersion({
          name: `projects/${project}/secrets/${name}/versions/latest`,
        });
        const value = version.payload?.data?.toString();
        if (value) {
          cache.set(name, value);
          loaded.push(name);
        } else {
          missing.push(name);
        }
      } catch {
        missing.push(name);
      }
    }),
  );
  return { loaded, missing };
}
