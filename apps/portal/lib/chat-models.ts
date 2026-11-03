// Chat model + effort options. Only models with a real provider path in
// the engine are selectable; other Meta models are pipeline-specific
// (image generation, ASR, grounding, deep-dive) and shown as Coming Soon,
// never selectable. Effort is a thinking-token budget - it changes the
// max_tokens sent to the provider, not just a label.

export type ChatModelChoice = "auto" | "baseten" | "meta" | "heuristic";
export type ChatEffort = "low" | "medium" | "high";

export const CHAT_MODELS: Array<{ id: ChatModelChoice; label: string; provider: string; note: string }> = [
  { id: "auto", label: "Auto", provider: "Baseten, then Meta", note: "Best available first" },
  { id: "baseten", label: "Muse Spark Open", provider: "Baseten", note: "meta-models/muse-spark-open-1026" },
  { id: "meta", label: "Muse Spark 1.3", provider: "Meta Model API", note: "muse-spark-1.3" },
  { id: "heuristic", label: "Offline heuristic", provider: "Built in, no model", note: "Keyword router, no credits used" },
];

export const COMING_SOON_MODELS: Array<{ label: string; provider: string; why: string }> = [
  { label: "Muse Wonder 1.0", provider: "Meta", why: "Deep-dive escalation, not a chat model yet" },
  { label: "Muse Image 1.0", provider: "Meta", why: "Powers redesigns, not chat" },
  { label: "Muse Voice Transcribe 1.0", provider: "Meta", why: "Already transcribes voice notes" },
  { label: "SAM 3.1", provider: "Meta", why: "Screenshot grounding, not chat" },
];

export const CHAT_EFFORTS: Array<{ id: ChatEffort; label: string }> = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

/** Thinking-token budget per provider and effort. Baseten needs more: its reasoning eats the budget first. */
export function effortBudget(provider: "baseten" | "meta", effort: ChatEffort): number {
  if (provider === "baseten") return effort === "low" ? 1200 : effort === "high" ? 5000 : 2500;
  return effort === "low" ? 400 : effort === "high" ? 2000 : 800;
}
