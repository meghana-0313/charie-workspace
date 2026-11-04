// GCP calls from the portal over ADC (attached service account on Cloud Run,
// `gcloud auth application-default login` locally). Powers repo builds:
// GCS uploads, Cloud Build triggers, Cloud Run deploys.

import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

async function token(): Promise<string> {
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error("no GCP access token");
  return t.token;
}

async function call(url: string, opts: { method?: string; body?: unknown; token: string }): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      authorization: `Bearer ${opts.token}`,
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  return { status: res.status, json };
}

export function gcpProject(): string {
  const p = process.env.GCP_PROJECT_ID ?? "";
  if (!p) throw new Error("GCP_PROJECT_ID not set");
  return p;
}

export function gcsBucket(): string {
  const b = process.env.GCS_BUCKET ?? "";
  if (!b) throw new Error("GCS_BUCKET not set");
  return b;
}

/** Simple upload (fits tarballs under the 64MB cap via resumable session). */
export async function gcsUpload(object: string, bytes: Buffer, contentType: string): Promise<void> {
  const t = await token();
  const bucket = gcsBucket();
  const init = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=resumable`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ name: object }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!init.ok) throw new Error(`GCS upload init failed: ${init.status}`);
  const put = await fetch(init.headers.get("location") ?? "", {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(bytes.byteLength) },
    body: bytes as unknown as BodyInit,
    signal: AbortSignal.timeout(180000),
  });
  if (!put.ok) throw new Error(`GCS upload failed: ${put.status}`);
}

export async function cloudBuildCreate(build: Record<string, unknown>): Promise<string> {
  const t = await token();
  const { status, json } = await call(`https://cloudbuild.googleapis.com/v1/projects/${gcpProject()}/builds`, {
    method: "POST",
    token: t,
    body: build,
  });
  if (status !== 200) throw new Error(`Cloud Build create failed: ${status}`);
  const id = (json as { metadata?: { build?: { id?: string } } }).metadata?.build?.id;
  if (!id) throw new Error("Cloud Build gave no id");
  return id;
}

export async function cloudBuildStatus(id: string): Promise<string> {
  const t = await token();
  const { json } = await call(`https://cloudbuild.googleapis.com/v1/projects/${gcpProject()}/builds/${id}`, { token: t });
  return (json as { status?: string }).status ?? "UNKNOWN";
}

function runBase(): string {
  return `https://run.googleapis.com/v2/projects/${gcpProject()}/locations/us-central1/services`;
}

export async function runGetService(name: string): Promise<{ exists: boolean; url?: string }> {
  const t = await token();
  const { status, json } = await call(`${runBase()}/${name}`, { token: t });
  if (status === 404) return { exists: false };
  if (status !== 200) throw new Error(`Cloud Run get failed: ${status}`);
  return { exists: true, url: (json as { uri?: string }).uri };
}

/** Create or update a public app service running the built image. Returns its URL. */
export async function runDeployApp(name: string, image: string): Promise<string> {
  const t = await token();
  const container = {
    image,
    ports: [{ containerPort: 8080 }],
    resources: { limits: { cpu: "1", memory: "512Mi" } },
  };
  const existing = await runGetService(name);
  let url: string | undefined;
  if (existing.exists) {
    const { status } = await call(`${runBase()}/${name}?updateMask=template.containers`, {
      method: "PATCH",
      token: t,
      body: { template: { containers: [container] } },
    });
    if (status !== 200) throw new Error(`Cloud Run patch failed: ${status}`);
    url = (await runGetService(name)).url;
  } else {
    // Create returns a long-running Operation, not the service: read back.
    const created = await call(`${runBase()}?service_id=${name}`, {
      method: "POST",
      token: t,
      body: { template: { containers: [container] } },
    });
    if (created.status !== 200) throw new Error(`Cloud Run create failed: ${created.status}`);
    url = (await runGetService(name)).url;
  }
  if (!url) throw new Error("Cloud Run gave no URL");
  // Public invoker so Charie (and the user) can drive it.
  await call(`${runBase()}/${name}:setIamPolicy`, {
    method: "POST",
    token: t,
    body: {
      policy: {
        bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }],
      },
    },
  });
  // Wait until the app actually serves (cold revision + IAM propagation).
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    try {
      const probe = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (probe.status < 500) return url;
    } catch {
      /* not up yet */
    }
  }
  throw new Error("Deployed app never served traffic");
}
