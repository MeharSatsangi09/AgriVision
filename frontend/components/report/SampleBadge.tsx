"use client";
import { FlaskConical } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

// Honest marker for seeded / hand-edited demo reports (report.isSeeded), so they can't be mistaken for genuine diagnoses.
export default function SampleBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      title={t("result.sample")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary/80",
        className
      )}
    >
      <FlaskConical className="size-3" aria-hidden /> {t("result.sample")}
    </span>
  );
}
