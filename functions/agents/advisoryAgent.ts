import { LlmAgent } from "@google/adk";
import { MODEL } from "./diagnosisAgent";

// Advisory Agent — reads {diagnosis} and {location} from session state (set by the
// Diagnosis Agent's outputKey and the initial session), writes `advisory`.
export const advisoryAgent = new LlmAgent({
  name: "advisory_agent",
  model: MODEL,
  description: "Writes a context-aware plain-language advisory for the farmer.",
  instruction: `You are an agronomy advisor for small farmers in India.
Diagnosis (JSON): {diagnosis}
Location: {location}
Today's date: {today}
Give a short, plain-language advisory (under 120 words): immediate action, treatment, prevention.
Consider the region and season. If confidence is below 0.6, say the result is uncertain and recommend an expert check.
No markdown.`,
  outputKey: "advisory",
});
