// App ingest keys: long-lived secrets for prod apps and SDKs.
// Format chp_<prefix8>_<secret32>. Only hashes touch the store.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { hashSecret } from "./auth";
import { store, uid } from "./store";
import type { ApiKey } from "./types";

export async function mintApiKey(name: string, ownerUid?: string): Promise<{ record: ApiKey; secret: string }> {
  const prefix = randomBytes(4).toString("hex");
  const secretPart = randomBytes(16).toString("hex");
  const salt = randomBytes(16).toString("hex");
  const record: ApiKey = {
    id: uid("key"), prefix, name: name.slice(0, 60), salt,
    hash: hashSecret(secretPart, salt), createdAt: new Date().toISOString(), revoked: false,
    ...(ownerUid ? { uid: ownerUid } : {}),
  };
  await store.saveApiKey(record);
  return { record, secret: `chp_${prefix}_${secretPart}` };
}

export async function verifyApiKey(secret: string): Promise<ApiKey | null> {
  const m = /^chp_([0-9a-f]{8})_([0-9a-f]{32})$/.exec(secret.trim());
  if (!m) return null;
  const rec = await store.getApiKeyByPrefix(m[1]).catch(() => null);
  if (!rec) return null;
  if (rec.revoked) return null;
  const a = Buffer.from(rec.hash);
  const b = Buffer.from(hashSecret(m[2], rec.salt));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  await store.touchApiKey(rec.id).catch(() => {});
  return rec;
}
