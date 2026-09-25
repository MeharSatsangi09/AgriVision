"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import ReportRow, { ReportScroller } from "@/components/report/ReportRow";
import { useData } from "@/lib/data";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { diseaseName } from "@/lib/diseases";

// Community feed: every public report, newest first. Only shows data that is already public on the map (photo,
// disease, rounded location, time) plus a display name derived from the report's own id (never from who uploaded it).
export default function ReportsFeed() {
  const { t, lang } = useI18n();
  const { reports, ready } = useData(); // live Firestore snapshot, already newest-first
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter((r) => {
      const local = diseaseName(r.diagnosis.disease, lang, r.diseaseTranslations?.[lang]);
      return r.diagnosis.disease.toLowerCase().includes(needle) || local.toLowerCase().includes(needle);
    });
  }, [reports, q, lang]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("reports.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("reports.subtitle")}</p>
        </div>
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">{t("reports.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("reports.search")}
            className="w-full rounded-xl border border-primary/25 bg-white/70 py-2 pl-9 pr-3 text-sm outline-none backdrop-blur-sm transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      {!ready ? null : shown.length === 0 ? (
        <p className="rounded-2xl border border-primary/25 bg-primary/5 p-8 text-center text-sm text-muted-foreground">{t("reports.none")}</p>
      ) : (
        <ReportScroller>
          {shown.map((r) => (
            <li key={r.id}>
              <ReportRow report={r} showName />
            </li>
          ))}
        </ReportScroller>
      )}
    </div>
  );
}
