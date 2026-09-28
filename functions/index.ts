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
import { transcribeAudio } from "./tools/speechTool";
import { uploaderUid } from "./tools/uploader";
import { transliterate } from "./agents/transliterationAgent";

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
    const uid = uploaderUid(metadata); // owner for "My Reports"; the uid only, never the phone number
    // Server-side guard (the UI checks too): don't spend Gemini quota on points outside India.
    if (!inIndia(lat, lng)) return recordFailure(name, "location");

    const file = getStorage().bucket(bucketName).file(name);
    const [buf] = await file.download();

    try {
      const { diagnosis, advisory, regenerativeTip, classifier, satelliteData, soilHealth } = await runAnalysis(buf, contentType, lat, lng, bucketName);

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
        ...(satelliteData ? { satelliteData } : {}),
        ...(soilHealth ? { soilHealth } : {}),
        ...(uid ? { uid } : {}),
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

// Translate the fixed frontend UI dictionary through the same server-side translation service.
// The payload is bounded because this callable is intentionally usable without user authentication.
export const translateUi = onCall({ region: REGION, maxInstances: 3, memory: "256MiB" }, async (req) => {
  const { lang, entries } = (req.data ?? {}) as { lang?: unknown; entries?: unknown };
  if (!isLang(lang) || !entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new HttpsError("invalid-argument", "lang and UI entries are required");
  }

  const source = entries as Record<string, unknown>;
  const pairs = Object.entries(source).filter(
    ([key, text]) => /^[A-Za-z0-9_.-]{1,80}$/.test(key) && typeof text === "string" && text.trim().length > 0 && text.length <= 500
  );
  if (!pairs.length || pairs.length > 120 || pairs.reduce((total, [, text]) => total + String(text).length, 0) > 20_000) {
    throw new HttpsError("invalid-argument", "too many or invalid UI entries");
  }

  try {
    const translated = await translateTexts(pairs.map(([, text]) => String(text)), lang);
    return Object.fromEntries(pairs.map(([key], index) => [key, translated[index]]));
  } catch (err) {
    console.error(`translateUi ${lang} failed:`, err);
    throw new HttpsError("unavailable", "UI translation unavailable");
  }
});

// Agent 5 — a farmer's grounded follow-up question about their specific report. Unlike translateReport
// (which only ever translates text WE already stored), this is the first callable where free-text farmer
// input reaches an LLM. Kept low-risk: the agent has no tools (no side effects it could be tricked into),
// its instruction keeps it on-topic, the answer is shown only to the same person who asked it, nothing is
// written back to the report, and maxInstances/length caps bound cost/abuse.
export const askFollowUpQuestion = onCall({ region: REGION, maxInstances: 3, memory: "256MiB", timeoutSeconds: 60 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "log in first");
  const { reportId, question, lang, conversationId } = (req.data ?? {}) as { reportId?: unknown; question?: unknown; lang?: unknown; conversationId?: unknown };
  if (typeof reportId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(reportId)) {
    throw new HttpsError("invalid-argument", "a valid reportId is required");
  }
  if (conversationId !== undefined && (typeof conversationId !== "string" || !/^[A-Za-z0-9]{20}$/.test(conversationId))) {
    throw new HttpsError("invalid-argument", "invalid conversationId");
  }
  const q = typeof question === "string" ? question.trim() : "";
  if (!q || q.length > 300) throw new HttpsError("invalid-argument", "question must be 1-300 characters");

  const ref = getFirestore().collection("reports").doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "report not found");
  const r = snap.data()!;
  if (r.uid !== uid) throw new HttpsError("permission-denied", "this report is not yours");

  const db = getFirestore();
  const conversations = db.collection("users").doc(uid).collection("followUpConversations");
  const conversationRef = conversationId ? conversations.doc(conversationId) : conversations.doc();
  const conversationSnap = await conversationRef.get();
  if (conversationSnap.exists && conversationSnap.data()?.reportId !== reportId) {
    throw new HttpsError("permission-denied", "conversation does not belong to this report");
  }
  const historySnap = conversationSnap.exists
    ? await conversationRef.collection("messages").orderBy("createdAt", "desc").limit(12).get()
    : { docs: [] };
  const history = historySnap.docs.reverse().map((message) => {
    const data = message.data();
    return `${data.role === "assistant" ? "Assistant" : "Farmer"}: ${String(data.text ?? "").slice(0, 600)}`;
  }).join("\n");

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
      conversationHistory: history || "(new conversation)",
    },
    q
  );

  const targetLang = isLang(lang) ? lang : undefined;
  let answer = answerEn;
  let answerLang = "en";
  let translationFailed = false;
  if (targetLang) {
    try {
      [answer] = await translateTexts([answerEn], targetLang);
      answerLang = targetLang;
    } catch (err) {
      console.error(`askFollowUp translate ${targetLang} failed:`, err);
      translationFailed = true;
    }
  }

  const batch = db.batch();
  if (!conversationSnap.exists) {
    batch.set(conversationRef, { reportId, title: q.slice(0, 70), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastMessage: q.slice(0, 160), messageCount: 0 });
  }
  batch.set(conversationRef.collection("messages").doc(), { role: "user", text: q, lang: typeof lang === "string" ? lang : "en", source: "text", createdAt: new Date().toISOString() });
  batch.set(conversationRef.collection("messages").doc(), { role: "assistant", text: answer, lang: answerLang, source: "ai", createdAt: new Date().toISOString() });
  batch.set(conversationRef, { updatedAt: new Date().toISOString(), lastMessage: answer.slice(0, 160), messageCount: (conversationSnap.data()?.messageCount ?? 0) + 2 }, { merge: true });
  await batch.commit();

  return { conversationId: conversationRef.id, answer, lang: answerLang, translationFailed };
});

export const listFollowUpConversations = onCall({ region: REGION, maxInstances: 3, memory: "256MiB" }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "log in first");
  const reportId = (req.data as { reportId?: unknown } | undefined)?.reportId;
  if (typeof reportId !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(reportId)) throw new HttpsError("invalid-argument", "a valid reportId is required");
  const report = await getFirestore().collection("reports").doc(reportId).get();
  if (!report.exists || report.data()?.uid !== uid) throw new HttpsError("permission-denied", "this report is not yours");
  const snap = await getFirestore().collection("users").doc(uid).collection("followUpConversations").where("reportId", "==", reportId).orderBy("updatedAt", "desc").limit(20).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
});

export const getFollowUpConversation = onCall({ region: REGION, maxInstances: 3, memory: "256MiB" }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "log in first");
  const conversationId = (req.data as { conversationId?: unknown } | undefined)?.conversationId;
  if (typeof conversationId !== "string" || !/^[A-Za-z0-9]{20}$/.test(conversationId)) throw new HttpsError("invalid-argument", "invalid conversationId");
  const ref = getFirestore().collection("users").doc(uid).collection("followUpConversations").doc(conversationId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "conversation not found");
  const messages = await ref.collection("messages").orderBy("createdAt", "asc").limit(40).get();
  return { id: snap.id, ...snap.data(), messages: messages.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});

// Cloud Speech-to-Text for the Follow-up box's mic button (frontend/components/report/FollowUpBox.tsx).
// A short WEBM/Opus recording of the farmer's spoken question comes in as base64; the transcript fills
// the text input for the farmer to review/edit before submitting through the normal askFollowUpQuestion
// flow above -- this callable never itself answers a question, it only transcribes.
export const transcribeSpeech = onCall({ region: REGION, maxInstances: 3, memory: "256MiB", timeoutSeconds: 30 }, async (req) => {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "log in first");
  const { audio, langCode } = (req.data ?? {}) as { audio?: unknown; langCode?: unknown };
  if (typeof audio !== "string" || !audio) throw new HttpsError("invalid-argument", "audio (base64) is required");
  // ~750 KB decoded is generous for a few seconds of a short spoken question; guards cost/abuse.
  if (audio.length > 1_000_000) throw new HttpsError("invalid-argument", "audio too large");
  const lang = typeof langCode === "string" && /^[a-z]{2}-[A-Z]{2}$/.test(langCode) ? langCode : "en-IN";

  try {
    const { transcript, confidence } = await transcribeAudio(audio, lang);
    return { transcript, confidence };
  } catch (err) {
    console.error("transcribeSpeech failed:", err);
    throw new HttpsError("unavailable", "transcription unavailable");
  }
});

// The logged-in user's own profile text (name, village/town, district), shown in the site's current language by
// TRANSLITERATING it (same name, other script; plain machine translation gets names wrong). Only the caller's own
// users/{uid} document is read. Results are cached on it under `translations.<lang>`; the client overwrites the whole
// document on every save, which drops the cache, so a cached value can never be stale. If the model is unavailable the
// call returns {} and the page just shows what the user typed.
const PROFILE_TEXT_FIELDS = ["firstName", "lastName", "place", "district"] as const;
export const translateProfile = onCall({ region: REGION, maxInstances: 3, memory: "256MiB", timeoutSeconds: 60 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "log in first");
  const lang = (req.data as { lang?: unknown } | undefined)?.lang;
  if (lang !== "en" && !isLang(lang)) throw new HttpsError("invalid-argument", "a supported lang is required");

  const ref = getFirestore().collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return {};
  const data = snap.data() as Record<string, unknown> & { translations?: Record<string, Record<string, string>> };
  const fields: Record<string, string> = {};
  for (const f of PROFILE_TEXT_FIELDS) {
    const v = data[f];
    if (typeof v === "string" && v.trim() && v.length <= 60) fields[f] = v.trim();
  }
  if (!Object.keys(fields).length) return {};
  const cached = data.translations?.[lang];
  if (cached && Object.keys(fields).every((f) => cached[f])) return cached;

  const result = await transliterate(fields, lang);
  if (!result) return {};
  await ref.update({ [`translations.${lang}`]: result });
  return result;
});
