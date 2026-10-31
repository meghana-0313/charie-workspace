// Voice bug reports (M4). Transcribes uploaded intake audio via Muse Voice
// Transcribe into { subject, body } for ticket creation. Needs ffmpeg for
// non-WAV input (installed in the engine container). Null on any failure,
// in which case the portal keeps the manual subject/body flow.

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { secret } from "./secrets.js";
import { extractGoal } from "./triage.js";
import type { FetchImpl } from "./baseten.js";

function hasFfmpeg(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function toWav(src: string): string {
  if (src.toLowerCase().endsWith(".wav")) return src;
  if (!hasFfmpeg()) throw new Error("ffmpeg missing for non-WAV audio");
  const out = join(tmpdir(), `ghostqa-voice-${Date.now()}.wav`);
  execFileSync("ffmpeg", ["-y", "-i", src, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", "-map_metadata", "-1", out], {
    stdio: "ignore",
  });
  return out;
}

export async function transcribe(
  audioPath: string,
  fetchImpl: FetchImpl = fetch,
): Promise<{ subject: string; body: string } | null> {
  const key = secret("META_API_KEY");
  if (!key) {
    console.warn("[voice] no key; audio stored as-is");
    return null;
  }
  try {
    const wav = toWav(audioPath);
    const bytes = await readFile(wav);
    const base = (secret("META_API_BASE_URL") ?? "https://api.meta.ai/v1").replace(/\/$/, "");
    const model = secret("META_VOICE_MODEL") ?? "muse-voice-transcribe-1.0";
    const sessionId = `ghostqa-${Date.now().toString(36)}`;
    const form = new FormData();
    form.set("request", new Blob([JSON.stringify({ mode: "DIARIZATION", model, audioEncoding: "WAV" })], { type: "application/json" }));
    form.set("audio", new Blob([new Uint8Array(bytes)], { type: "audio/wav" }), "note.wav");
    const res = await fetchImpl(`${base}/asr/transcribe?sessionId=${sessionId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Voice Transcribe error: ${res.status}`);
    const data = (await res.json()) as {
      transcript?: string;
      turns?: Array<{ transcript?: string }>;
    };
    const text =
      data.transcript?.trim() ||
      (data.turns ?? []).map((t) => t.transcript?.trim()).filter(Boolean).join(" ");
    if (!text) return null;
    return { subject: extractGoal(text, ""), body: text.slice(0, 2000) };
  } catch (e) {
    console.warn(`[voice] transcription skipped: ${(e as Error).message}`);
    return null;
  }
}
