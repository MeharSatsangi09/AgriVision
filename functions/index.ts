import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage, getDownloadURL } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { runAnalysis, QuotaError } from "./agents/pipeline";
import { reconcile } from "./agents/reconciliationAgent";
import { askFollowUp } from "./agents/followUpAgent";
import { runTrendCheck } from "./agents/trendAgent";
import { writeReport, firestoreTrendStore } from "./tools/firestoreTools";
import { isLang, translateTexts } from "./tools/translate";
import { inIndia } from "./tools/india";

initializeApp();

const REGION = "asia-south1";
// Public map data is rounded to ~1 km so a farm's exact position is never stored or shown.
const round2 = (n: number) => Math.round(n * 100) / 100;

async function recordFailure(path: string, reason: "quota" | "location" | "other") {
  await getFirestore().collection("uploadErrors").add({ path, reason, timestamp: new Date().toISOString() });
}

// Storage upload -> ADK pipeline (Diagnosis -> Advisory) + our trained classifier side by side -> Firestore `reports` -> trend check.
// minInstances: 1 keeps one instance warm so a demo upload doesn't wait ~45 s for a cold start
// (small idle cost; set to 0 to turn off).
export const processUpload = onObjectFinalized(
  { region: REGION, memory: "1GiB", timeoutSeconds: 300, maxInstances: 5, minInstances: 1 },
  async (event) => {
    const { name, contentType, bucket: bucketName, metadata } = event.data;
    if (!name.startsWith("uploads/") || !contentType?.startsWith("image/")) return;

    const lat = Number(metadata?.lat);
    const lng = Number(metadata?.lng);
    // Server-side guard (the UI checks too): don't spend Gemini quota on points outside India.
    if (!inIndia(lat, lng)) return recordFailure(name, "location");

    const file = getStorage().bucket(bucketName).file(name);
    const [buf] = await file.download();

    try {
      const { diagnosis, advisory, regenerativeTip, classifier } = await runAnalysis(buf, contentType, lat, lng, bucketName);

      // Reconciliation Agent (Agent 4): adjudicates Gemini vs. the classifier. Runs only when both signals
      // exist; never blocks or fails the report (reconcile() always resolves, with a rule-based fallback).
      let reconciliation;
      if (classifier) {
        try {
          reconciliation = await reconcile({
            geminiDisease: diagnosis.disease,
            geminiSeverity: diagnosis.severity,
            geminiConfidence: diagnosis.confidence,
            geminiNeedsReview: diagnosis.needsReview,
            classifierCondition: classifier.condition || classifier.crop,
            classifierConfidence: classifier.confidence,
            classifierLowConfidence: !!classifier.lowConfidence,
          });
          console.log("reconciliation:", JSON.stringify(reconciliation));
        } catch (err) {
          console.error("reconciliation failed:", err);
        }
      }

      await writeReport({
        photoUrl: await getDownloadURL(file),
        lat: round2(lat),
        lng: round2(lng),
        diagnosis,
        advisory,
        ...(regenerativeTip ? { regenerativeTip } : {}),
        ...(classifier ? { classifier } : {}),
        ...(reconciliation ? { reconciliation } : {}),
      });
    } catch (err) {
      console.error("processUpload failed:", err);
      // Lets the frontend stop waiting and show the right message for this upload.
      await recordFailure(name, err instanceof QuotaError ? "quota" : "other");
      return;
    }

    // Check for an outbreak right away so the alert shows up in the demo; failures here never affect the report.
    try {
      console.log("trend check:", await runTrendCheck(firestoreTrendStore));
    } catch (err) {
      console.error("trend check failed:", err);
    }
  }
);

// Safety net: re-scan periodically, and expire alerts whose cluster has aged out.
export const scheduledTrendCheck = onSchedule(
  { schedule: "every 60 minutes", region: REGION, timeoutSeconds: 120, maxInstances: 1 },
  async () => {
    console.log("scheduled trend check:", await runTrendCheck(firestoreTrendStore));
  }
);

// On-demand translation of an existing report's advisory + disease name. Results are cached on the
// report document, so each (report, language) pair is translated at most once and only stored text is
// ever translated (no user-supplied text), which bounds cost and abuse.
export const translateReport = onCall({ region: REGION, maxInstances: 3, memory: "256MiB" }, async (req) => {
  const { reportId, lang } = (req.data ?? {}) as { reportId?: unknown; lang?: unknown };
  if (typeof reportId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(reportId) || !isLang(lang)) {
    throw new HttpsError("invalid-argument", "reportId and a supported lang are required");
  }
  const ref = getFirestore().collection("reports").doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "report not found");
  const r = snap.data()!;

  // Source English text + its Firestore field name, per translatable piece. Reconciliation (Agent 4's
  // adjudicated answer) is optional, same as followUp — only present when that piece exists on the report.
  const sources: Record<string, string> = {
    advisory: String(r.advisory ?? ""),
    disease: String(r.diagnosis?.disease ?? ""),
    followUp: String(r.diagnosis?.followUp ?? ""),
    regenerativeTip: String(r.regenerativeTip ?? ""),
    reconciliationDiagnosis: String(r.reconciliation?.finalDiagnosis ?? ""),
    reconciliationReasoning: String(r.reconciliation?.reasoning ?? ""),
  };
  const cachedMaps: Record<string, string> = {
    advisory: "advisoryTranslations", disease: "diseaseTranslations", followUp: "followUpTranslations",
    regenerativeTip: "regenerativeTipTranslations",
    reconciliationDiagnosis: "reconciliationDiagnosisTranslations", reconciliationReasoning: "reconciliationReasoningTranslations",
  };
  const needed = Object.entries(sources).filter(([, text]) => text);
  const cached: Record<string, string | undefined> = {};
  for (const [key, mapName] of Object.entries(cachedMaps)) cached[key] = r[mapName]?.[lang];
  if (needed.every(([key]) => cached[key])) return cached;

  try {
    const translated = await translateTexts(needed.map(([, text]) => text), lang);
    const result: Record<string, string> = {};
    const updates: Record<string, string> = {};
    needed.forEach(([key], i) => {
      result[key] = translated[i];
      updates[`${cachedMaps[key]}.${lang}`] = translated[i];
    });
    await ref.update(updates);
    return result;
  } catch (err) {
    console.error(`translateReport ${lang} failed:`, err);
    throw new HttpsError("unavailable", "translation unavailable");
  }
});

// Agent 5 — a farmer's grounded follow-up question about their specific report. Unlike translateReport
// (which only ever translates text WE already stored), this is the first callable where free-text farmer
// input reaches an LLM. Kept low-risk: the agent has no tools (no side effects it could be tricked into),
// its instruction keeps it on-topic, the answer is shown only to the same person who asked it, nothing is
// written back to the report, and maxInstances/length caps bound cost/abuse.
export const askFollowUpQuestion = onCall({ region: REGION, maxInstances: 3, memory: "256MiB", timeoutSeconds: 60 }, async (req) => {
  const { reportId, question, lang } = (req.data ?? {}) as { reportId?: unknown; question?: unknown; lang?: unknown };
  if (typeof reportId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(reportId)) {
    throw new HttpsError("invalid-argument", "a valid reportId is required");
  }
  const q = typeof question === "string" ? question.trim() : "";
  if (!q || q.length > 300) throw new HttpsError("invalid-argument", "question must be 1-300 characters");

  const ref = getFirestore().collection("reports").doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "report not found");
  const r = snap.data()!;

  const reconciliationSummary = r.reconciliation
    ? `Our own trained model was also checked against Gemini's diagnosis: ${r.reconciliation.reasoning}`
    : "";

  const answerEn = await askFollowUp(
    {
      disease: String(r.diagnosis?.disease ?? "unclear"),
      severity: String(r.diagnosis?.severity ?? "low"),
      confidence: Number(r.diagnosis?.confidence ?? 0),
      advisory: String(r.advisory ?? ""),
      location: `lat ${r.lat}, lng ${r.lng}`,
      reconciliationSummary,
    },
    q
  );

  const targetLang = isLang(lang) ? lang : undefined;
  if (!targetLang) return { answer: answerEn, lang: "en" };
  try {
    const [translated] = await translateTexts([answerEn], targetLang);
    return { answer: translated, lang: targetLang };
  } catch (err) {
    console.error(`askFollowUp translate ${targetLang} failed:`, err);
    return { answer: answerEn, lang: "en", translationFailed: true };
  }
});
