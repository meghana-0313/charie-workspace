import { NextResponse } from "next/server";
import { checkInvite } from "@/lib/auth";
import { store } from "@/lib/store";
import { identity } from "@/lib/who";
import { speakableText } from "@/lib/room-status";

// Charie's human voice, provider-pluggable (organizers allow third-party
// TTS; Muse Spark remains the brain):
// 1. Cartesia Sonic (CARTESIA_API_KEY) - built for live voice agents,
//    first audio in well under a second per short clause.
// 2. Modal-hosted Kokoro (CHARIE_TTS_URL) - the previous primary.
// 3. Client browser voice when both are unset or failing.
// The response header x-charie-tts names the provider that actually
// served the line. Fails soft with 503 - she is never silent.
export const maxDuration = 60;

// Short phrases repeat constantly in a call (greetings, the voice test).
// Cache them in memory so repeats skip the TTS cold start entirely.
const cache = new Map<string, { audio: ArrayBuffer; type: string; at: number }>();
const CACHE_MS = 10 * 60 * 1000;
// Identical lines requested at the same moment (warmup + test click, or
// several portal replicas of one room) share one upstream synthesis.
const inflight = new Map<string, Promise<{ audio: ArrayBuffer; type: string }>>();

async function synthesizeCartesia(clean: string): Promise<{ audio: ArrayBuffer; type: string }> {
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-Key": process.env.CARTESIA_API_KEY as string,
      "Cartesia-Version": "2024-06-10",
    },
    body: JSON.stringify({
      model_id: process.env.CARTESIA_MODEL ?? "sonic-2",
      transcript: clean,
      voice: { mode: "id", id: process.env.CARTESIA_VOICE_ID ?? "a0e99841-438c-4a64-b679-ae501e7d6091" },
      output_format: { container: "wav", encoding: "pcm_f32le", sample_rate: 44100 },
    }),
    // A voice-agent provider must be fast or not used for this chunk:
    // on timeout the caller falls back instead of stacking latency.
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`voice upstream ${res.status}`);
  return { audio: await res.arrayBuffer(), type: "audio/wav" };
}

async function synthesize(url: string, clean: string): Promise<{ audio: ArrayBuffer; type: string }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.CHARIE_TTS_MODAL_KEY && process.env.CHARIE_TTS_MODAL_SECRET) {
    headers["Modal-Key"] = process.env.CHARIE_TTS_MODAL_KEY;
    headers["Modal-Secret"] = process.env.CHARIE_TTS_MODAL_SECRET;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: clean }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`voice upstream ${res.status}`);
  return { audio: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "audio/wav" };
}

async function allowed(req: Request, roomId: string): Promise<boolean> {
  if (await identity(req)) return true;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return checkInvite(roomId, token);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;
  const room = await store.getMeetRoom(roomId);
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });
  if (!(await allowed(req, roomId))) return NextResponse.json({ error: "login or invite required" }, { status: 401 });
  const url = process.env.CHARIE_TTS_URL;
  const provider = process.env.CARTESIA_API_KEY ? "cartesia" : url ? "modal" : null;
  if (!provider) return NextResponse.json({ error: "voice not configured" }, { status: 503 });
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const clean = speakableText(String(text ?? ""));
  if (!clean) return NextResponse.json({ error: "text required" }, { status: 400 });
  const cacheKey = `${provider}:${clean}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return new NextResponse(hit.audio, { headers: { "content-type": hit.type, "cache-control": "no-store", "x-charie-tts": `cache-${provider}` } });
  }
  try {
    let pending = inflight.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        if (provider === "cartesia") {
          try {
            return await synthesizeCartesia(clean);
          } catch (e) {
            // Cartesia down or key/voice invalid: one quick Modal try
            // before the client drops to the browser voice.
            if (url) return synthesize(url, clean);
            throw e;
          }
        }
        return synthesize(url as string, clean);
      })();
      inflight.set(cacheKey, pending);
      pending.catch(() => {}).finally(() => inflight.delete(cacheKey));
    }
    const { audio, type } = await pending;
    if (clean.length <= 160) {
      cache.set(cacheKey, { audio, type, at: Date.now() });
      if (cache.size > 40) cache.delete(cache.keys().next().value as string);
    }
    return new NextResponse(audio, { headers: { "content-type": type, "cache-control": "no-store", "x-charie-tts": provider } });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg.startsWith("voice upstream") ? msg : "voice unreachable" }, { status: 503 });
  }
}
