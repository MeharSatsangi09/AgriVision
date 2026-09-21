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
}

export interface UploadFailure {
  path: string;
  reason?: "quota" | "location" | "other";
}

export interface LatLng {
  lat: number;
  lng: number;
}
