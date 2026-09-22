"use client";
import { BadgeCheck, ImageOff } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { titleCase } from "@/lib/format";
import type { Reconciliation } from "@/lib/types";

// Agent 4's adjudicated answer — the PRIMARY result, shown front-and-center above everything else on the
// report (Gemini's and the classifier's individual outputs remain below as supporting detail, unchanged).
export default function ReconciliationHero({
  reconciliation,
  diagnosis,
  reasoning,
}: {
  reconciliation: Reconciliation;
  diagnosis?: string; // translated finalDiagnosis (falls back to English if translation isn't ready)
  reasoning?: string; // translated reasoning
}) {
  const { t } = useI18n();
  const unclear = reconciliation.action === "request_clearer_photo";

  if (unclear) {
    return (
      <div className="flex gap-3 rounded-2xl border border-severity-medium/40 bg-severity-medium/10 p-4">
        <ImageOff className="mt-0.5 size-6 shrink-0 text-severity-medium" />
        <div>
          <h2 className="text-lg font-semibold text-severity-medium">{t("recon.unclearTitle")}</h2>
          <p className="mt-1 text-sm text-severity-medium">{reasoning || reconciliation.reasoning}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("recon.retake")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-accent p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("recon.label")}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-accent-foreground">
        {titleCase(diagnosis || reconciliation.finalDiagnosis)}
      </h2>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
        <BadgeCheck className="size-3.5" /> {t("recon.confirmed")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-accent-foreground/90">{reasoning || reconciliation.reasoning}</p>
    </div>
  );
}
