"use client";
import Link from "next/link";
import { MapPin, ShieldCheck, TriangleAlert } from "lucide-react";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { groupOutbreaks, useData, type Outbreak } from "@/lib/data";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { timeAgo, titleCase } from "@/lib/format";

export default function AlertsView() {
  const { t } = useI18n();
  const { reports, ready } = useData();
  const outbreaks = groupOutbreaks(reports);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("alerts.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("alerts.subtitle")}</p>
        </div>
        <div className="rounded-2xl border bg-card px-5 py-3 shadow-sm">
          <div className={`flex items-baseline text-3xl font-bold ${outbreaks.length ? "text-severity-high" : "text-primary"}`}>
            <SlidingNumber number={outbreaks.length} />
          </div>
          <p className="text-xs text-muted-foreground">{t("alerts.active")}</p>
        </div>
      </div>

      {!outbreaks.length && (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <ShieldCheck className="size-10 text-primary" />
          <p className="text-muted-foreground">{ready ? t("alerts.none") : "…"}</p>
        </div>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {outbreaks.map((o) => (
          <AlertCard key={o.key} outbreak={o} />
        ))}
      </ul>

      <p className="text-sm text-muted-foreground">{t("alerts.rule")}</p>
    </div>
  );
}

function AlertCard({ outbreak: o }: { outbreak: Outbreak }) {
  const { t, lang } = useI18n();
  const name = o.latest.diseaseTranslations?.[lang] ?? titleCase(o.disease);
  return (
    <li className="overflow-hidden rounded-2xl border border-severity-high/30 bg-card shadow-sm">
      <div className="flex items-center gap-3 bg-severity-high/10 px-5 py-3 text-severity-high">
        <TriangleAlert className="size-5 shrink-0" />
        <h2 className="text-lg font-semibold">{name}</h2>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-[15px]">{t("alerts.summary", { n: o.reports.length, d: name })}</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-muted px-3 py-1">{t("alerts.reports", { n: o.reports.length })}</span>
          {o.high > 0 && (
            <span className="rounded-full bg-severity-high/15 px-3 py-1 text-severity-high">{t("alerts.high", { n: o.high })}</span>
          )}
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {t("alerts.latest")}: {timeAgo(o.latest.timestamp, lang)}
          </span>
        </div>
        <div className="flex -space-x-2">
          {o.reports.slice(0, 5).map((r) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={r.id} src={r.photoUrl} alt="" className="size-10 rounded-full border-2 border-card object-cover" />
          ))}
        </div>
        <Link
          href={`/map?focus=${o.latest.id}`}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted"
        >
          <MapPin className="size-4" /> {t("result.onMap")}
        </Link>
      </div>
    </li>
  );
}
