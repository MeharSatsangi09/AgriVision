"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ImagePlus } from "lucide-react";
import SeverityBadge from "@/components/report/SeverityBadge";
import SampleBadge from "@/components/report/SampleBadge";
import { db, isDemoMode } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { timeAgo, titleCase } from "@/lib/format";
import type { Report } from "@/lib/types";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const row = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

// The logged-in user's own reports: photo, disease, date, link to the full report. Reads the same public `reports`
// collection as the map, filtered by the report's `uid` (set by the upload function from the authenticated uploader).
export default function MyReportsView() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    if (!user || isDemoMode) return setReports([]);
    setReports(null);
    return onSnapshot(
      query(collection(db, "reports"), where("uid", "==", user.uid)),
      (snap) => {
        // Sorted here (not with orderBy) so no composite Firestore index is needed.
        const mine = snap.docs.map((d) => d.data() as Report);
        mine.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setReports(mine);
      },
      () => setReports([])
    );
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("myreports.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("myreports.subtitle")}</p>
      </div>

      {reports === null ? null : reports.length === 0 ? (
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-primary/[0.04] p-8 text-center">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{t("myreports.empty")}</p>
          <Link
            href="/diagnose"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <ImagePlus className="size-4" /> {t("myreports.cta")}
          </Link>
        </div>
      ) : (
        <motion.ul variants={list} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2">
          {reports.map((r) => {
            const d = r.diagnosis;
            const name = r.diseaseTranslations?.[lang] ?? titleCase(d.disease);
            const shown = !["unclear", "healthy"].includes(d.disease.toLowerCase());
            return (
              <motion.li key={r.id} variants={row}>
                <Link
                  href={`/report/${r.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-[#eef7ea] via-white to-[#e6f3e2] p-3 shadow-sm transition-[box-shadow,border-color] duration-300 hover:border-primary/30 hover:shadow-[0_0_18px_3px_rgba(47,107,58,0.2)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photoUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {shown && <SeverityBadge severity={d.severity} className="px-2 py-0 text-[11px]" />}
                      {r.isSeeded && <SampleBadge className="px-1.5 py-0 text-[10px]" />}
                      {timeAgo(r.timestamp, lang)}
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
