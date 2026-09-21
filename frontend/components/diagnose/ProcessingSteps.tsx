"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Phase } from "@/components/diagnose/useDiagnose";
import { cn } from "@/lib/utils";

// Three steps. The backend doesn't report progress, so steps 2 -> 3 advance on a rough timer.
export default function ProcessingSteps({ phase }: { phase: Phase }) {
  const { t } = useI18n();
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const active = phase === "uploading" ? 0 : secs < 12 ? 1 : 2;
  const steps = ["steps.uploading", "steps.diagnosing", "steps.advising"];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center shadow-sm"
      aria-live="polite"
    >
      <ol className="space-y-4 text-left">
        {steps.map((key, i) => (
          <li key={key} className={cn("flex items-center gap-3 text-base transition", i > active && "text-muted-foreground/60")}>
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full border",
                i < active && "border-primary bg-primary text-primary-foreground",
                i === active && "border-primary text-primary"
              )}
            >
              {i < active ? <Check className="size-4" /> : i === active ? <Loader2 className="size-4 animate-spin" /> : i + 1}
            </span>
            <span className={cn(i === active && "font-medium")}>{t(key)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-muted-foreground">{t("steps.wait")}</p>
    </motion.section>
  );
}
