import { LlmAgent, InMemoryRunner } from "@google/adk";
import { MODEL } from "./diagnosisAgent";
import { agreesWith } from "../tools/classifierTool";
import { createReconciliationTools } from "../tools/reconciliationTools";

export type ReconciliationAction = "confident" | "deferred_to_gemini" | "request_clearer_photo";

export interface Reconciliation {
  finalDiagnosis: string;
  reasoning: string;
  action: ReconciliationAction;
  agreedWithClassifier: boolean;
}

export interface ReconciliationInput {
  geminiDisease: string;
  geminiSeverity: string;
  geminiConfidence: number;
  geminiNeedsReview: boolean;
  classifierCondition: string;
  classifierConfidence: number;
  classifierLowConfidence: boolean;
}

const APP = "reconciliation";
const TIMEOUT_MS = 45_000;
const ACTIONS: ReconciliationAction[] = ["confident", "deferred_to_gemini", "request_clearer_photo"];

function buildAgent(input: ReconciliationInput) {
  const { compareSymptoms, checkClassOverlap } = createReconciliationTools(input);
  return new LlmAgent({
    name: "reconciliation_agent",
    model: MODEL,
    description: "Adjudicates disagreement between the Diagnosis Agent (Gemini) and the custom classifier.",
    instruction: `You are adjudicating two independent opinions about a crop-disease photo for an Indian farmer.

Signal A — Diagnosis Agent (Gemini, general vision + world knowledge): disease "${input.geminiDisease}", severity ${input.geminiSeverity}, confidence ${input.geminiConfidence.toFixed(2)}${input.geminiNeedsReview ? " (Gemini itself flagged this as low confidence)" : ""}.
Signal B — our own trained classifier (MobileNetV2, closed-set: only knows 38 PlantVillage disease classes, unreliable outside that set): "${input.classifierCondition}", confidence ${input.classifierConfidence.toFixed(2)}${input.classifierLowConfidence ? " (below our 80% trust threshold)" : ""}.

Steps:
1. Call compare_symptoms and check_class_overlap to gather structured evidence on whether A and B plausibly agree.
2. Decide using this policy, in order:
   a. If the tools show A and B plausibly describe the same thing -> action="deferred_to_gemini" (classifier corroborates Gemini), finalDiagnosis = Gemini's disease name, agreedWithClassifier=true.
   b. Else if Gemini flagged low confidence AND the classifier is below its trust threshold (both weak, and they disagree) -> action="request_clearer_photo". Do not force a confident-sounding answer when neither signal actually is confident. finalDiagnosis="".
   c. Else if only the classifier is below its trust threshold (Gemini is confident) -> action="deferred_to_gemini", finalDiagnosis = Gemini's disease name, agreedWithClassifier=false.
   d. Else if only Gemini flagged low confidence (classifier is confident and specific) -> action="confident", finalDiagnosis = the classifier's condition (it is the only confident signal here), agreedWithClassifier=true.
   e. Else (both are confident and genuinely disagree) -> action="confident". Gemini has open-world knowledge and can name diseases/crops outside the classifier's 38 classes, so prefer Gemini's diagnosis UNLESS check_class_overlap shows no category overlap at all AND Gemini's confidence is only moderate (well under 0.9) AND the classifier's confidence is very high (>= 0.9) — in that rare case go with the classifier instead. Set agreedWithClassifier accordingly (true only if your final pick equals the classifier's condition).
3. In every case write a short reasoning string (<= 30 words, plain language, no jargon) explaining the decision using the tool outputs.
4. Reply with JSON only, no other text: {"finalDiagnosis": string, "reasoning": string, "action": "confident"|"deferred_to_gemini"|"request_clearer_photo", "agreedWithClassifier": boolean}.`,
    tools: [compareSymptoms, checkClassOverlap],
  });
}

// Deterministic fallback if the LLM call fails or times out — never blocks the report on this new agent.
// Same decision table as the agent's instruction above, computed directly with agreesWith()/thresholds.
export function ruleBasedReconciliation(input: ReconciliationInput): Reconciliation {
  const same = agreesWith({ condition: input.classifierCondition }, input.geminiDisease);
  if (same) {
    return { finalDiagnosis: input.geminiDisease, reasoning: "Our model and Gemini agree.", action: "deferred_to_gemini", agreedWithClassifier: true };
  }
  if (input.geminiNeedsReview && input.classifierLowConfidence) {
    return {
      finalDiagnosis: "",
      reasoning: "Neither result was confident enough — please retake a clear, close-up photo of the affected leaf.",
      action: "request_clearer_photo",
      agreedWithClassifier: false,
    };
  }
  if (input.classifierLowConfidence) {
    return {
      finalDiagnosis: input.geminiDisease,
      reasoning: "Our model wasn't confident, so we used Gemini's diagnosis.",
      action: "deferred_to_gemini",
      agreedWithClassifier: false,
    };
  }
  if (input.geminiNeedsReview) {
    return {
      finalDiagnosis: input.classifierCondition,
      reasoning: "Gemini was unsure; our trained model gave a confident, specific answer.",
      action: "confident",
      agreedWithClassifier: true,
    };
  }
  return {
    finalDiagnosis: input.geminiDisease,
    reasoning: "Gemini and our model disagree; Gemini's broader knowledge is used as the primary result.",
    action: "confident",
    agreedWithClassifier: false,
  };
}

export function parseReconciliation(raw: string, fallback: Reconciliation): Reconciliation {
  const text = raw.replace(/```json|```/g, "").trim();
  let p: any;
  try {
    p = JSON.parse(text);
  } catch {
    return fallback;
  }
  const action: ReconciliationAction = ACTIONS.includes(p.action) ? p.action : fallback.action;
  return {
    finalDiagnosis: typeof p.finalDiagnosis === "string" ? p.finalDiagnosis.trim().slice(0, 80) : fallback.finalDiagnosis,
    reasoning: typeof p.reasoning === "string" && p.reasoning.trim() ? p.reasoning.trim().slice(0, 240) : fallback.reasoning,
    action,
    agreedWithClassifier: typeof p.agreedWithClassifier === "boolean" ? p.agreedWithClassifier : fallback.agreedWithClassifier,
  };
}

// Runs the Reconciliation Agent. Always resolves (never throws): the LLM call is wrapped so a failure or
// timeout falls back to the same decision table computed deterministically, per rule c/d of the task spec.
export async function reconcile(input: ReconciliationInput): Promise<Reconciliation> {
  const fallback = ruleBasedReconciliation(input);
  try {
    const runner = new InMemoryRunner({ agent: buildAgent(input), appName: APP });
    const sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await runner.sessionService.createSession({ appName: APP, userId: "system", sessionId });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let raw = "";
    try {
      for await (const ev of runner.runAsync({
        userId: "system",
        sessionId,
        abortSignal: ctl.signal,
        newMessage: { role: "user", parts: [{ text: "Adjudicate now." }] },
      })) {
        if (ev.errorCode) throw new Error(`${ev.author}: ${ev.errorCode} ${ev.errorMessage ?? ""}`);
        const text = ev.content?.parts?.map((p) => p.text ?? "").join("").trim();
        if (text && ev.author === "reconciliation_agent" && !ev.content?.parts?.some((p) => p.functionCall)) raw = text;
      }
    } finally {
      clearTimeout(timer);
    }
    return raw ? parseReconciliation(raw, fallback) : fallback;
  } catch (err) {
    console.warn("reconciliation agent failed, using rule fallback:", err);
    return fallback;
  }
}
