import { LlmAgent } from "@google/adk";

// Model IDs retire quickly — override with GEMINI_MODEL in functions/.env instead of editing code.
export const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export interface Diagnosis {
  disease: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  needsReview: boolean;
  followUp?: string;
}

const CONFIDENCE_THRESHOLD = 0.6;

// Controlled vocabulary keeps outbreak clustering reliable ("black spot" vs "Black spot disease").
export const DISEASES = [
  "Healthy", "Unclear", "Black spot", "Powdery mildew", "Downy mildew", "Leaf rust", "Yellow rust", "Brown rust",
  "Anthracnose", "Bacterial blight", "Bacterial leaf spot", "Early blight", "Late blight", "Leaf curl virus",
  "Mosaic virus", "Rice blast", "Rice brown spot", "Sheath blight", "Red rot", "Gray leaf spot", "Northern leaf blight",
  "Septoria leaf spot", "Target spot", "Leaf mold", "Apple scab", "Black rot", "Citrus canker", "Citrus greening",
  "Cercospora leaf spot", "Alternaria leaf spot", "Spider mite damage", "Nutrient deficiency", "Wilt",
];

// Diagnosis Agent — Gemini multimodal via ADK. Result lands in session state under `diagnosis`.
export const diagnosisAgent = new LlmAgent({
  name: "diagnosis_agent",
  model: MODEL,
  description: "Diagnoses crop disease/health from a photo.",
  instruction: `You are a crop pathologist. Analyze the crop photo in the user message.
Reply with JSON only: {"disease": string, "severity": "low"|"medium"|"high", "confidence": number 0-1, "followUp": string}.
- "disease": use one of these exact names when it fits: ${DISEASES.join(", ")}. Otherwise a short generic name (max 3 words). Never add the words "disease" or "infection".
- Use "Healthy" for a healthy plant. Use "Unclear" (confidence below 0.3) if the image is not a crop or is too unclear.
- "followUp": only when confidence is below 0.6 — one short sentence telling the farmer what photo would help (e.g. "Take a close-up of the underside of one affected leaf in daylight."). Otherwise "".`,
  outputKey: "diagnosis",
  generateContentConfig: { responseMimeType: "application/json" },
});

const SYNONYMS: Record<string, string> = {
  "blast": "rice blast",
  "leaf blast": "rice blast",
  "blight": "bacterial blight",
  "late blight": "late blight",
  "early blight": "early blight",
  "powdery mildew": "powdery mildew",
  "rust": "leaf rust",
};

// Lower-cases, strips filler words/punctuation and maps a few common synonyms.
export function normalizeDisease(raw: string): string {
  let d = raw.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z\s-]/g, " ");
  d = d.replace(/\b(disease|infection|symptoms?|of|the|caused by|fungal|bacterial infection)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!d) return "unclear";
  return SYNONYMS[d] ?? d;
}

// Normalizes the agent's raw text output into the Firestore contract shape.
export function parseDiagnosis(raw: unknown): Diagnosis {
  const text = typeof raw === "string" ? raw.replace(/```json|```/g, "").trim() : "{}";
  let p: any = {};
  try {
    p = JSON.parse(text);
  } catch {
    /* fall through to needsReview defaults */
  }
  const confidence = Math.max(0, Math.min(1, Number(p.confidence) || 0));
  const needsReview = confidence < CONFIDENCE_THRESHOLD;
  const followUp = needsReview && typeof p.followUp === "string" ? p.followUp.trim().slice(0, 160) : "";
  return {
    disease: normalizeDisease(String(p.disease || "unclear")),
    severity: ["low", "medium", "high"].includes(p.severity) ? p.severity : "low",
    confidence,
    needsReview,
    ...(followUp ? { followUp } : {}),
  };
}
