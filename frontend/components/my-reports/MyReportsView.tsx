"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ImagePlus } from "lucide-react";
import ReportRow, { ReportScroller } from "@/components/report/ReportRow";
import { db, isDemoMode } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Report } from "@/lib/types";

// The logged-in user's own reports: photo, disease, date, link to the full report. Reads the same public `reports`
// collection as the map, filtered by the report's `uid` (set by the upload function from the authenticated uploader).
export default function MyReportsView() {
  const { t } = useI18n();
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
        <ReportScroller>
          {reports.map((r) => (
            <li key={r.id}>
              <ReportRow report={r} />
            </li>
          ))}
        </ReportScroller>
      )}
    </div>
  );
}
