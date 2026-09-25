"use client";
import { diseaseName } from "@/lib/diseases";
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { titleCase } from "@/lib/format";
import type { Report } from "@/lib/types";

type Pair = {
  advisory: string;
  disease: string;
  followUp?: string;
  regenerativeTip?: string;
  reconciliationDiagnosis?: string;
  reconciliationReasoning?: string;
};

const translateReport = httpsCallable<{ reportId: string; lang: string }, Pair>(functions, "translateReport");

// Session cache + in-flight de-duplication so switching languages back and forth costs nothing.
const cache = new Map<string, Pair>();
const inflight = new Map<string, Promise<Pair>>();

// Returns the report's advisory + disease name (+ reconciliation, if present) in `lang`. Uses translations already
// stored on the report, otherwise asks the backend (which caches the result on the report for everyone).
export function useTranslated(report: Report, lang: string) {
  const key = `${report.id}:${lang}`;
  const stored: Pair | undefined =
    lang !== "en" && report.advisoryTranslations?.[lang]
      ? {
          advisory: report.advisoryTranslations[lang],
          disease: report.diseaseTranslations?.[lang] ?? "",
          followUp: report.followUpTranslations?.[lang],
          regenerativeTip: report.regenerativeTipTranslations?.[lang],
          reconciliationDiagnosis: report.reconciliationDiagnosisTranslations?.[lang],
          reconciliationReasoning: report.reconciliationReasoningTranslations?.[lang],
        }
      : undefined;
  const [fetched, setFetched] = useState<{ key: string; v: Pair } | null>(null);
  const [failedKey, setFailedKey] = useState("");

  useEffect(() => {
    if (lang === "en" || stored) return;
    const hit = cache.get(key);
    if (hit) return setFetched({ key, v: hit });
    let live = true;
    const p = inflight.get(key) ?? translateReport({ reportId: report.id, lang }).then((r) => r.data);
    inflight.set(key, p);
    p.then((v) => {
      cache.set(key, v);
      if (live) setFetched({ key, v });
    })
      .catch(() => live && setFailedKey(key))
      .finally(() => inflight.delete(key));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!stored]);

  const t = stored ?? (fetched?.key === key ? fetched.v : undefined);
  const english = lang === "en";
  return {
    advisory: english ? report.advisory : t?.advisory || report.advisory,
    disease: diseaseName(report.diagnosis.disease, lang, t?.disease),
    followUp: english ? report.diagnosis.followUp : t?.followUp || report.diagnosis.followUp,
    regenerativeTip: english ? report.regenerativeTip : t?.regenerativeTip || report.regenerativeTip,
    reconciliationDiagnosis: report.reconciliation ? diseaseName(report.reconciliation.finalDiagnosis, lang, t?.reconciliationDiagnosis) : undefined,
    reconciliationReasoning: english ? report.reconciliation?.reasoning : t?.reconciliationReasoning || report.reconciliation?.reasoning,
    status: english || t?.advisory ? ("ok" as const) : failedKey === key ? ("error" as const) : ("loading" as const),
  };
}
