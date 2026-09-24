"use client";
import { useCallback, useEffect, useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { isDemoMode, storage } from "@/lib/firebase";
import { useData } from "@/lib/data";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { compressImage } from "@/lib/image";
import { roundCoord } from "@/lib/format";
import type { LatLng } from "@/lib/types";

export type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";
const GIVE_UP_MS = 150_000;

// Upload -> wait for the pipeline (report or failure record appears in Firestore) -> result.
export function useDiagnose() {
  const { reports, failures } = useData();
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState("");

  const submit = useCallback(
    async (file: File, loc: LatLng) => {
      setError("");
      if (isDemoMode) {
        setError("Visual-only mode: Firebase is not configured, so uploads are disabled.");
        setPhase("error");
        return;
      }
      setPhase("uploading");
      try {
        const body = await compressImage(file);
        const p = `uploads/${Date.now()}-${body.name.replace(/[^\w.-]/g, "_")}`;
        await uploadBytes(ref(storage, p), body, {
          contentType: body.type,
          // Rounded to ~1 km: a farm's exact position is never stored.
          customMetadata: { lat: String(roundCoord(loc.lat)), lng: String(roundCoord(loc.lng)) },
        });
        setPath(p);
        setPhase("analyzing");
      } catch {
        setError(t("err.upload"));
        setPhase("error");
      }
    },
    [t]
  );

  const report = path ? reports.find((r) => r.photoUrl.includes(encodeURIComponent(path))) ?? null : null;
  const failure = path ? failures.find((f) => f.path === path) ?? null : null;

  useEffect(() => {
    if (phase !== "analyzing") return;
    if (report) return setPhase("done");
    if (failure) {
      setError(t(failure.reason === "quota" ? "err.quota" : failure.reason === "location" ? "err.location" : "err.failed"));
      return setPhase("error");
    }
    const timer = setTimeout(() => {
      setError(t("err.slow"));
      setPhase("error");
    }, GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [phase, report, failure, t]);

  const reset = useCallback(() => {
    setPhase("idle");
    setPath(null);
    setError("");
  }, []);

  return { phase, report, error, submit, reset };
}
