// Voice bug reports (M4). Transcribes uploaded intake audio via Muse Voice
// Transcribe into { subject, body } for ticket creation. Until then the portal
// stores audio as-is and labels transcription pending.

import { secret } from "./secrets.js";

export async function transcribe(_audioPath: string): Promise<{ subject: string; body: string } | null> {
  if (!secret("META_API_KEY")) {
    console.warn("[voice] Muse Voice Transcribe pending (M4); audio stored as-is");
    return null;
  }
  console.warn("[voice] Muse Voice Transcribe pending (M4)");
  return null;
}
