import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage, getDownloadURL } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { runAnalysis, QuotaError } from "./agents/pipeline";
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
      const { diagnosis, advisory, classifier } = await runAnalysis(buf, contentType, lat, lng, bucketName);
      await writeReport({
        photoUrl: await getDownloadURL(file),
        lat: round2(lat),
        lng: round2(lng),
        diagnosis,
        advisory,
        ...(classifier ? { classifier } : {}),
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

  const followUpEn: string = r.diagnosis?.followUp ?? "";
  const cached = {
    advisory: r.advisoryTranslations?.[lang],
    disease: r.diseaseTranslations?.[lang],
    followUp: r.followUpTranslations?.[lang],
  };
  if (cached.advisory && cached.disease && (!followUpEn || cached.followUp)) return cached;

  const texts = [String(r.advisory ?? ""), String(r.diagnosis?.disease ?? ""), followUpEn].filter(Boolean);
  try {
    const out = await translateTexts(texts, lang);
    const [advisory, disease] = out;
    const followUp = followUpEn ? out[2] : undefined;
    await ref.update({
      [`advisoryTranslations.${lang}`]: advisory,
      [`diseaseTranslations.${lang}`]: disease,
      ...(followUp ? { [`followUpTranslations.${lang}`]: followUp } : {}),
    });
    return { advisory, disease, followUp };
  } catch (err) {
    console.error(`translateReport ${lang} failed:`, err);
    throw new HttpsError("unavailable", "translation unavailable");
  }
});
