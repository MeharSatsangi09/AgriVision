export type Severity = "low" | "medium" | "high";

export interface Report {
  id: string;
  photoUrl: string;
  lat: number;
  lng: number;
  timestamp: string;
  diagnosis: {
    disease: string;
    severity: Severity;
    confidence: number;
    needsReview: boolean;
    followUp?: string;
  };
  advisory: string;
  regenerativeTip?: string; // one low-cost/no-chemical practice tied to the diagnosis, from the Advisory Agent
  alert?: boolean;
  alertReason?: string;
  advisoryTranslations?: Record<string, string>;
  diseaseTranslations?: Record<string, string>;
  followUpTranslations?: Record<string, string>;
  regenerativeTipTranslations?: Record<string, string>;
  // Our own trained model's answer, shown side by side with Gemini's diagnosis (optional).
  classifier?: ClassifierResult;
  // Reconciliation Agent's adjudicated answer (Agent 4) — set only when the classifier also ran.
  reconciliation?: Reconciliation;
  reconciliationDiagnosisTranslations?: Record<string, string>;
  reconciliationReasoningTranslations?: Record<string, string>;
  // Earth Engine vegetation-index signal for the report's location (optional — omitted if the lookup
  // failed or timed out; never blocks the report).
  satelliteData?: SatelliteData;
}

export interface SatelliteData {
  ndvi: number; // -1..1
  date: string; // date of the underlying satellite composite, not the upload date
  source: string;
}

export type ReconciliationAction = "confident" | "deferred_to_gemini" | "request_clearer_photo";

export interface Reconciliation {
  finalDiagnosis: string;
  reasoning: string;
  action: ReconciliationAction;
  agreedWithClassifier: boolean;
}

export interface ClassifierResult {
  label: string;
  crop: string;
  condition: string;
  confidence: number;
  lowConfidence?: boolean; // confidence below the server threshold (80%)
  agreesWithGemini?: boolean; // classifier's answer matches Gemini's diagnosis
  top3: { label: string; confidence: number }[];
  model: string;
  ms: number;
}

export interface UploadFailure {
  path: string;
  reason?: "quota" | "location" | "other";
}

export interface LatLng {
  lat: number;
  lng: number;
}
