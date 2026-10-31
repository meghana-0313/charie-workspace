// Voice-note blobs: local .data/uploads in dev, Cloud Storage in prod
// (same ADC credentials as Firestore). Keys look like "uploads/<uid>-<file>".

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "./firebase";

const useGcs = () => process.env.PORTAL_STORE === "firestore" && !!process.env.GCS_BUCKET;

export function voiceContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext === "mp3" ? "audio/mpeg"
    : ext === "wav" ? "audio/wav"
    : ext === "ogg" ? "audio/ogg"
    : ext === "m4a" ? "audio/mp4"
    : ext === "webm" ? "audio/webm"
    : "application/octet-stream";
}

export async function saveVoiceNote(name: string, bytes: Buffer): Promise<string> {
  if (!useGcs()) {
    const dir = join(process.cwd(), ".data", "uploads");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(process.cwd(), ".data", name), bytes);
    return name;
  }
  await getStorage(adminApp()).bucket().file(name).save(bytes);
  return name;
}

export async function readVoiceNote(rel: string[]): Promise<{ data: Buffer; type: string } | null> {
  if (!useGcs()) {
    const base = join(process.cwd(), ".data", "uploads") + sep;
    const full = normalize(join(process.cwd(), ".data", "uploads", ...rel));
    if (!full.startsWith(base) || !existsSync(full)) return null;
    return { data: readFileSync(full), type: voiceContentType(full) };
  }
  const name = `uploads/${rel.join("/")}`;
  if (name.includes("..")) return null;
  try {
    const [data] = await getStorage(adminApp()).bucket().file(name).download();
    return { data, type: voiceContentType(name) };
  } catch {
    return null;
  }
}
