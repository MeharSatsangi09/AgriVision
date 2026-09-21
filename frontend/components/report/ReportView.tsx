"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ResultPanel from "@/components/report/ResultPanel";
import { useData } from "@/lib/data";
import { useI18n } from "@/lib/i18n/I18nProvider";

// Shareable page for a single report (linked from "Copy link").
export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const { reports, ready } = useData();
  const { t } = useI18n();
  const report = reports.find((r) => r.id === id);

  if (!report) {
    return (
      <div className="grid place-items-center gap-4 py-20 text-center">
        <p className="text-lg text-muted-foreground">{ready ? t("report.notfound") : "…"}</p>
        {ready && (
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <ArrowLeft className="size-4" /> {t("report.back")}
          </Link>
        )}
      </div>
    );
  }
  return <ResultPanel report={report} />;
}
