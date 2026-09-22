import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { Diagnosis } from "../agents/diagnosisAgent";
import type { TrendStore } from "./trendTools";
import type { ClassifierResult } from "./classifierTool";
import type { Reconciliation } from "../agents/reconciliationAgent";

const toTrend = (d: FirebaseFirestore.QueryDocumentSnapshot) => {
  const r = d.data();
  return {
    id: d.id,
    lat: Number(r.lat),
    lng: Number(r.lng),
    timestamp: String(r.timestamp),
    disease: String(r.diagnosis?.disease ?? ""),
    severity: String(r.diagnosis?.severity ?? ""),
    alert: !!r.alert,
  };
};

export interface ReportInput {
  photoUrl: string;
  lat: number;
  lng: number;
  diagnosis: Diagnosis;
  advisory: string;
  classifier?: ClassifierResult; // our own trained model's answer (side by side with Gemini)
  reconciliation?: Reconciliation; // Reconciliation Agent's adjudicated answer (Agent 4)
}

// Plain function: called deterministically by the Cloud Function after the pipeline runs.
export async function writeReport(r: ReportInput): Promise<string> {
  const ref = getFirestore().collection("reports").doc();
  await ref.set({ id: ref.id, ...r, timestamp: new Date().toISOString(), alert: false });
  return ref.id;
}

// Firestore-backed store used by the Trend/Alert Agent's tools.
export const firestoreTrendStore: TrendStore = {
  async recentReports(sinceIso) {
    const snap = await getFirestore().collection("reports").where("timestamp", ">=", sinceIso).get();
    return snap.docs.map(toTrend);
  },
  async alertedReports() {
    const snap = await getFirestore().collection("reports").where("alert", "==", true).get();
    return snap.docs.map(toTrend);
  },
  async flag(ids, reason) {
    const db = getFirestore();
    const batch = db.batch();
    let n = 0;
    for (const id of ids) {
      const ref = db.collection("reports").doc(id);
      if ((await ref.get()).exists) {
        batch.update(ref, { alert: true, alertReason: reason });
        n++;
      }
    }
    await batch.commit();
    return n;
  },
  async unflag(ids) {
    const db = getFirestore();
    const batch = db.batch();
    ids.forEach((id) => batch.update(db.collection("reports").doc(id), { alert: false, alertReason: FieldValue.delete() }));
    await batch.commit();
    return ids.length;
  },
};
