"use client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLE: Record<Severity, string> = {
  low: "bg-severity-low/15 text-severity-low",
  medium: "bg-severity-medium/15 text-severity-medium",
  high: "bg-severity-high/15 text-severity-high",
};

export default function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", STYLE[severity], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {t(`result.${severity}`)}
    </span>
  );
}
