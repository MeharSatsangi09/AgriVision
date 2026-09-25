"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { MapPin, Search } from "lucide-react";
import SeverityBadge from "@/components/report/SeverityBadge";
import SampleBadge from "@/components/report/SampleBadge";
import { useData } from "@/lib/data";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { roundCoord, timeAgo, titleCase } from "@/lib/format";
import { reportUsername } from "@/lib/username";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const row = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

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
      const local = r.diseaseTranslations?.[lang] ?? "";
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
        <motion.ul variants={list} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => {
            const d = r.diagnosis;
            const name = r.diseaseTranslations?.[lang] ?? titleCase(d.disease);
            const isDisease = !["unclear", "healthy"].includes(d.disease.toLowerCase());
            return (
              <motion.li key={r.id} variants={row}>
                <Link
                  href={`/report/${r.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-[#eef7ea] via-white to-[#e6f3e2] p-3 shadow-sm transition-[box-shadow,border-color] duration-300 hover:border-primary/30 hover:shadow-[0_0_18px_3px_rgba(47,107,58,0.2)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photoUrl} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-medium">{name}</span>
                      {isDisease && <SeverityBadge severity={d.severity} className="px-2 py-0 text-[11px]" />}
                      {r.isSeeded && <SampleBadge className="px-1.5 py-0 text-[10px]" />}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("reports.by")} <span className="font-medium text-foreground/80">{reportUsername(r.id)}</span> · {timeAgo(r.timestamp, lang)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" aria-hidden /> {roundCoord(r.lat)}°N, {roundCoord(r.lng)}°E
                    </span>
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
