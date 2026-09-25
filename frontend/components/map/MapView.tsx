"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import OutbreakMap from "@/components/map/OutbreakMap";
import ResultPanel from "@/components/report/ResultPanel";
import SeverityBadge from "@/components/report/SeverityBadge";
import SampleBadge from "@/components/report/SampleBadge";
import { useData } from "@/lib/data";
import { useSeen } from "@/lib/seen";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { timeAgo, titleCase } from "@/lib/format";
import { SEVERITY_COLOR } from "@/lib/maps";
import type { Report, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITIES: Severity[] = ["low", "medium", "high"];
const PERIODS = [
  { value: "7", key: "map.p7" },
  { value: "30", key: "map.p30" },
  { value: "all", key: "map.pall" },
] as const;

export default function MapView() {
  const { t, lang } = useI18n();
  const { reports, ready } = useData();
  const { active, loaded, markSeen } = useSeen();

  // The red hotspot circles are on screen here, so every active outbreak counts as seen (the circles themselves stay).
  const activeKeys = active.join("\n");
  useEffect(() => {
    if (ready && loaded && activeKeys) markSeen(activeKeys.split("\n"));
  }, [ready, loaded, activeKeys, markSeen]);
  const focus = useSearchParams().get("focus");
  const [selectedId, setSelectedId] = useState<string | null>(focus);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [disease, setDisease] = useState("all");
  const [period, setPeriod] = useState<"7" | "30" | "all">("all");

  const diseases = useMemo(() => [...new Set(reports.map((r) => r.diagnosis.disease))].sort(), [reports]);
  const filtered = useMemo(() => {
    const since = period === "all" ? 0 : Date.now() - Number(period) * 864e5;
    return reports.filter(
      (r) =>
        (severity === "all" || r.diagnosis.severity === severity) &&
        (disease === "all" || r.diagnosis.disease === disease) &&
        new Date(r.timestamp).getTime() >= since
    );
  }, [reports, severity, disease, period]);
  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const name = (r: Report) => r.diseaseTranslations?.[lang] ?? titleCase(r.diagnosis.disease);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("map.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("map.subtitle")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("map.severity")}>
          {(["all", ...SEVERITIES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                severity === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              )}
            >
              {s === "all" ? t("map.all") : t(`result.${s}`)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("map.disease")}
          <select value={disease} onChange={(e) => setDisease(e.target.value)} className="rounded-lg border bg-card px-2.5 py-1.5 text-foreground">
            <option value="all">{t("map.all")}</option>
            {diseases.map((d) => (
              <option key={d} value={d}>
                {titleCase(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("map.period")}
          <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="rounded-lg border bg-card px-2.5 py-1.5 text-foreground">
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {t(p.key)}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-sm text-muted-foreground">{t("map.count", { n: filtered.length })}</span>
      </div>

      {/* Map + list */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-2">
          <OutbreakMap reports={filtered} selectedId={selectedId} onSelect={setSelectedId} className="h-[55vh] min-h-80" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {SEVERITIES.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="size-3 rounded-full" style={{ background: SEVERITY_COLOR[s] }} /> {t(`result.${s}`)}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border border-severity-high bg-severity-high/20" /> {t("map.hotspot")}
            </span>
          </div>
        </div>

        <ul data-lenis-prevent className="max-h-[55vh] min-h-40 space-y-2 overflow-y-auto pr-1">
          {!filtered.length && (
            <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {ready ? t("map.none") : "…"}
            </li>
          )}
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left transition hover:bg-muted",
                  r.id === selectedId && "border-primary ring-1 ring-primary"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photoUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{name(r)}</span>
                    {r.alert && <TriangleAlert className="size-3.5 shrink-0 text-severity-high" />}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {!["unclear", "healthy"].includes(r.diagnosis.disease) && (
                      <SeverityBadge severity={r.diagnosis.severity} className="px-2 py-0 text-[11px]" />
                    )}
                    {r.isSeeded && <SampleBadge className="px-1.5 py-0 text-[10px]" />}
                    {timeAgo(r.timestamp, lang)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && <ResultPanel report={selected} />}
    </div>
  );
}
