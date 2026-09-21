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
  alert?: boolean;
  alertReason?: string;
  advisoryTranslations?: Record<string, string>;
  diseaseTranslations?: Record<string, string>;
  followUpTranslations?: Record<string, string>;
  // Our own trained model's answer, shown side by side with Gemini's diagnosis (optional).
  classifier?: ClassifierResult;
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
