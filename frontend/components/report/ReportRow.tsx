"use client";
import Link from "next/link";
import { MapPin } from "lucide-react";
import SeverityBadge from "@/components/report/SeverityBadge";
import SampleBadge from "@/components/report/SampleBadge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { roundCoord, timeAgo } from "@/lib/format";
import { diseaseName } from "@/lib/diseases";
import { reportUsername } from "@/lib/username";
import type { Report } from "@/lib/types";

// Compact one-line report card (small rectangle): thumbnail, disease + severity, then "by name · time · location".
// Fixed height so a scrolling list can show exactly N rows. `showName` adds the generated display name (id-derived).
export default function ReportRow({ report: r, showName = false }: { report: Report; showName?: boolean }) {
  const { t, lang } = useI18n();
  const d = r.diagnosis;
  const name = diseaseName(d.disease, lang, r.diseaseTranslations?.[lang]);
  const isDisease = !["unclear", "healthy"].includes(d.disease.toLowerCase());
  return (
    <Link
      href={`/report/${r.id}`}
      className="flex h-16 items-center gap-3 rounded-xl border border-primary/15 bg-gradient-to-br from-[#eef7ea] via-white to-[#e6f3e2] px-2.5 shadow-sm transition-[box-shadow,border-color] duration-300 hover:border-primary/30 hover:shadow-[0_0_14px_2px_rgba(47,107,58,0.2)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.photoUrl} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {isDisease && <SeverityBadge severity={d.severity} className="px-1.5 py-0 text-[10px]" />}
          {r.isSeeded && <SampleBadge className="px-1.5 py-0 text-[10px]" />}
        </span>
        <span className="mt-0.5 flex items-center gap-x-1.5 truncate text-[11px] text-muted-foreground">
          {showName && (
            <>
              {t("reports.by")} <span className="font-medium text-foreground/80">{reportUsername(r.id)}</span> ·
            </>
          )}
          {timeAgo(r.timestamp, lang)} · <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            {roundCoord(r.lat)}°N, {roundCoord(r.lng)}°E
          </span>
        </span>
      </span>
    </Link>
  );
}

// Scroll box that shows four rows, then scrolls (data-lenis-prevent so the page's smooth scroll doesn't hijack the wheel).
export function ReportScroller({ children }: { children: React.ReactNode }) {
  return (
    <ul data-lenis-prevent className="max-h-[18rem] space-y-2 overflow-y-auto overscroll-contain p-1 pr-2 [scrollbar-width:thin]">
      {children}
    </ul>
  );
}
