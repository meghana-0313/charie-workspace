// Customer Signals: support inbox, chat, and call transcripts flow in here.
// Spark grades sentiment and theme per message (keyword fallback offline),
// then messages cluster into themes by token overlap. A hot cluster becomes
// a Work Order proposal in one click.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FetchImpl } from "./baseten.js";
import { chat, modelId } from "./meta-client.js";
import { secret } from "./secrets.js";

export interface SignalMessage {
  id: string;
  channel: "support" | "chat" | "call" | "review";
  author: string;
  text: string;
  ts: string;
  sentiment?: "angry" | "frustrated" | "neutral" | "praise";
  theme?: string;
}

export interface SignalCluster {
  id: string;
  theme: string;
  size: number;
  angryShare: number; // 0..1 of messages angry/frustrated
  sampleIds: string[];
  samples: string[];
  workOrderId?: string;
}

const STOP = new Set(
  "the,a,an,and,or,but,to,of,in,on,for,with,is,are,was,were,it,its,this,that,my,i,me,we,us,you,your,our,they,them,he,she,his,her,at,by,from,as,be,been,have,has,had,do,does,did,not,no,yes,so,if,than,then,there,here,when,what,which,who,how,can,could,would,should,just,really,very,please,thanks,thank,hi,hello".split(","),
);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n / Math.max(1, Math.min(a.size, b.size));
}

/** Greedy single-pass clustering: join the best overlapping cluster or seed one. */
export function clusterMessages(messages: SignalMessage[]): SignalCluster[] {
  const clusters: SignalMessage[][] = [];
  for (const m of messages) {
    const mt = new Set(tokens(m.text));
    let best = -1;
    let bestScore = 0.34;
    clusters.forEach((c, i) => {
      const ct = new Set(c.flatMap((x) => tokens(x.text)));
      const s = overlap(mt, ct);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    if (best >= 0) clusters[best].push(m);
    else clusters.push([m]);
  }
  return clusters
    .map((c, i) => {
      const counts = new Map<string, number>();
      for (const m of c) for (const t of tokens(m.text)) counts.set(t, (counts.get(t) ?? 0) + 1);
      const topWords = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t)
        .join(" ");
      const theme = c[0].theme ?? (topWords || `cluster ${i + 1}`);
      const hot = c.filter((m) => m.sentiment === "angry" || m.sentiment === "frustrated").length;
      return {
        id: `cl_${i}`,
        theme,
        size: c.length,
        angryShare: c.length === 0 ? 0 : hot / c.length,
        sampleIds: c.slice(0, 5).map((m) => m.id),
        samples: c.slice(0, 3).map((m) => m.text.slice(0, 160)),
      } satisfies SignalCluster;
    })
    .sort((a, b) => b.size - a.size || b.angryShare - a.angryShare);
}

const ANGRY = /\b(furious|angry|furious|terrible|awful|worst|hate|disgusting|refund|scam|broken|useless|ridiculous)\b/i;
const FRUSTRATED = /\b(frustrat|annoy|stuck|again|still|tried|failed|error|bug|issue|problem|wrong|broken|slow|waiting)\b/i;
const PRAISE = /\b(thanks|thank you|great|love|awesome|excellent|perfect|fast|easy|helpful|amazing)\b/i;

export function keywordSentiment(text: string): SignalMessage["sentiment"] {
  if (ANGRY.test(text)) return "angry";
  if (PRAISE.test(text) && !FRUSTRATED.test(text)) return "praise";
  if (FRUSTRATED.test(text)) return "frustrated";
  return "neutral";
}

/** Grade sentiment + theme with Spark; keyword fallback keeps it working offline. */
export async function gradeMessage(m: SignalMessage, fetchImpl: FetchImpl = fetch): Promise<Pick<SignalMessage, "sentiment" | "theme">> {
  const fallback = { sentiment: keywordSentiment(m.text), theme: undefined as string | undefined };
  if (!secret("META_API_KEY")) return fallback;
  try {
    const out = await chat(
      [
        {
          role: "system",
          content:
            "Grade a customer message. Reply exactly:\nSENTIMENT: <angry|frustrated|neutral|praise>\nTHEME: <3 to 6 words naming the topic>",
        },
        { role: "user", content: m.text.slice(0, 1000) },
      ],
      { model: modelId("spark"), maxTokens: 120, fetchImpl },
    );
    const sentiment = out.match(/^SENTIMENT:\s*(angry|frustrated|neutral|praise)/m)?.[1];
    const theme = out.match(/^THEME:\s*(.+)$/m)?.[1]?.trim();
    return {
      sentiment: (sentiment as SignalMessage["sentiment"]) ?? fallback.sentiment,
      theme: theme || undefined,
    };
  } catch {
    return fallback;
  }
}

function dataFile(root: string): string {
  mkdirSync(root, { recursive: true });
  return join(root, "signals.json");
}

export function loadMessages(root: string): SignalMessage[] {
  const f = dataFile(root);
  if (!existsSync(f)) return [];
  try {
    return JSON.parse(readFileSync(f, "utf8")) as SignalMessage[];
  } catch {
    return [];
  }
}

export function appendMessages(root: string, msgs: SignalMessage[]): SignalMessage[] {
  const all = [...loadMessages(root), ...msgs].slice(-2000);
  writeFileSync(dataFile(root), JSON.stringify(all, null, 2));
  return all;
}

export function seedMessages(): Array<Omit<SignalMessage, "id" | "ts">> {
  return [
    { channel: "support", author: "priya@example.com", text: "Checkout failed 3 times with my card, then I got charged twice. This is ridiculous, I want a refund." },
    { channel: "chat", author: "guest-4412", text: "I tried to pay twice and both times it said payment failed. Is my order placed or not?" },
    { channel: "call", author: "+1-555-0142", text: "Transcript: customer furious, double charge on checkout, demands callback today." },
    { channel: "review", author: "marta", text: "Love the passes but checkout is so slow, I almost gave up. Page spins forever after I click pay." },
    { channel: "support", author: "li@example.com", text: "The pay button spins and nothing happens. Tried again this morning, still stuck." },
    { channel: "chat", author: "guest-4471", text: "Thanks! The new pass picker is great, bought 3 passes in a minute." },
  ];
}
