import { LlmAgent } from "@google/adk";
import { MODEL } from "./diagnosisAgent";

export interface Advisory {
  advisory: string;
  regenerativeTip?: string;
}

// Advisory Agent — reads {diagnosis} and {location} from session state (set by the
// Diagnosis Agent's outputKey and the initial session), writes `advisory` (raw JSON text;
// parsed by parseAdvisory below into the {advisory, regenerativeTip} shape the pipeline uses).
export const advisoryAgent = new LlmAgent({
  name: "advisory_agent",
  model: MODEL,
  description: "Writes a context-aware plain-language advisory for the farmer, plus one regenerative practice tied to the diagnosis.",
  instruction: `You are an agronomy advisor for small farmers in India.
Diagnosis (JSON): {diagnosis}
Location: {location}
Today's date: {today}
Weather forecast for this location (next ~24h, may be empty if unavailable): {weather}
Reply with JSON only: {"advisory": string, "regenerativeTip": string}.
- "advisory": a short, plain-language advisory (under 120 words): immediate action, treatment, prevention. Consider the region and season. If the weather forecast says rain is expected soon, factor that into WHEN to act — e.g. don't recommend spraying a fungicide/pesticide right before expected rain (it washes off wasted), suggest spraying after the rain passes instead, unless the situation is urgent enough that immediate action still matters more than the wasted spray. If no weather forecast is given, give timing guidance without mentioning weather. If confidence is below 0.6, say the result is uncertain and recommend an expert check. No markdown.
- "regenerativeTip": ONE specific low-cost, no-chemical regenerative practice grounded in this exact disease (e.g. a crop rotation that breaks this pathogen's cycle, a neem-based or other biological alternative to a chemical spray, a companion-planting or cultural practice that suppresses this specific disease). Under 40 words, plain language, no markdown. If the diagnosis is "Healthy" or "Unclear", use "".`,
  outputKey: "advisory",
  generateContentConfig: { responseMimeType: "application/json" },
});

// Normalizes the agent's raw JSON text output into the shape the pipeline/Firestore use.
export function parseAdvisory(raw: unknown): Advisory {
  const text = typeof raw === "string" ? raw.replace(/```json|```/g, "").trim() : "{}";
  let p: any = {};
  try {
    p = JSON.parse(text);
  } catch {
    // Not valid JSON (e.g. a model hiccup) — treat the whole thing as the advisory text, no tip.
    return { advisory: text };
  }
  const advisory = String(p.advisory ?? "").trim();
  const regenerativeTip = typeof p.regenerativeTip === "string" ? p.regenerativeTip.trim().slice(0, 300) : "";
  return { advisory, ...(regenerativeTip ? { regenerativeTip } : {}) };
}
