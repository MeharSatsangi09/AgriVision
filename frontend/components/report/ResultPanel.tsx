"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Cpu, Lightbulb, Link2, MapPin, RotateCcw, Sprout, TriangleAlert } from "lucide-react";
import { Progress } from "@/components/animate-ui/components/radix/progress";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import SeverityBadge from "@/components/report/SeverityBadge";
import ReconciliationHero from "@/components/report/ReconciliationHero";
import FollowUpBox from "@/components/report/FollowUpBox";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useData, groupOutbreaks } from "@/lib/data";
import { useSeen } from "@/lib/seen";
import { useTranslated } from "@/lib/useTranslated";
import { roundCoord, timeAgo } from "@/lib/format";
import type { Report } from "@/lib/types";

// Staggered reveal for the report's sections — phases.md calls this "the emotional payoff moment of the demo."
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export default function ResultPanel({ report, onAnother }: { report: Report; onAnother?: () => void }) {
  const { t, lang } = useI18n();
  const { reports } = useData();
  const tr = useTranslated(report, lang);
  const [copied, setCopied] = useState(false);
  const { loaded, markSeen } = useSeen();
  const d = report.diagnosis;
  const pct = Math.round(d.confidence * 100);
  const unclear = d.disease.toLowerCase() === "unclear";
  const healthy = d.disease.toLowerCase() === "healthy";
  // "Second opinion" trust state: uncertain when the model is under the server's 80% threshold, or when it
  // disagrees with Gemini (softmax confidence alone can't catch confidently-wrong answers on unknown crops).
  const cls = report.classifier;
  const lowConfidence = !!cls && (cls.lowConfidence ?? cls.confidence < 0.8);
  const uncertain = !!cls && (lowConfidence || cls.agreesWithGemini === false);
  // refinement.md #6: once the Reconciliation Agent has adjudicated, this card's own guidance must not make a
  // separate, potentially-contradictory trust claim ("treat the AI diagnosis above as main result" was wrong
  // when Reconciliation actually sided with the classifier). Defer to Reconciliation's own agreedWithClassifier
  // verdict instead of the fixed lowConfidence/differs copy. Styling (amber border/icon) and the no-reconciliation
  // wording are unchanged.
  const uncertainMessageKey = report.reconciliation
    ? report.reconciliation.agreedWithClassifier
      ? "result.model.reconMatch"
      : "result.model.reconDiffer"
    : lowConfidence
      ? "result.model.uncertain"
      : "result.model.differs";
  const outbreak = report.alert ? groupOutbreaks(reports).find((o) => o.key === report.alertReason) : undefined;

  // Showing the outbreak notice below means this viewer has seen the outbreak.
  const outbreakKey = outbreak?.key;
  useEffect(() => {
    if (outbreakKey && loaded) markSeen([outbreakKey]);
  }, [outbreakKey, loaded, markSeen]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/report/${report.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <motion.article
      initial="hidden"
      animate="show"
      variants={container}
      className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm md:p-6"
    >
      {report.reconciliation && (
        <motion.div variants={item}>
          <ReconciliationHero
            reconciliation={report.reconciliation}
            diagnosis={tr.reconciliationDiagnosis}
            reasoning={tr.reconciliationReasoning}
          />
        </motion.div>
      )}

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        variants={item}
        src={report.photoUrl}
        alt=""
        className="aspect-square w-full max-w-64 rounded-xl object-cover md:max-w-none"
      />

      <div className="min-w-0 space-y-4">
        <motion.div variants={item}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{tr.disease}</h2>
            {!unclear && !healthy && <SeverityBadge severity={d.severity} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {timeAgo(report.timestamp, lang)} · {roundCoord(report.lat)}°N, {roundCoord(report.lng)}°E
          </p>
        </motion.div>

        {outbreak && (
          <motion.div
            variants={item}
            className="flex gap-3 rounded-xl border border-severity-high/30 bg-severity-high/10 p-3 text-sm text-severity-high"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">{t("result.outbreak")}</p>
              <p>{t("alerts.summary", { n: outbreak.reports.length, d: tr.disease })}</p>
            </div>
          </motion.div>
        )}

        {!unclear && (
          <motion.div variants={item} className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-baseline font-semibold text-foreground">
              <SlidingNumber number={pct} fromNumber={0} />%
            </span>
            <span>{t("result.confidence")}</span>
            <Progress value={pct} className="max-w-56" />
          </motion.div>
        )}

        {unclear && (
          <motion.p variants={item} className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            {t("result.unclear")}
          </motion.p>
        )}
        {d.needsReview && !unclear && (
          <motion.p variants={item} className="rounded-xl bg-severity-medium/10 p-3 text-sm text-severity-medium">
            {t("result.review")}
          </motion.p>
        )}
        {d.followUp && (
          <motion.p variants={item} className="flex gap-2 rounded-xl bg-accent p-3 text-sm text-accent-foreground">
            <Lightbulb className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>{t("result.tip")}:</strong> {tr.followUp}
            </span>
          </motion.p>
        )}

        {report.advisory && (
          <motion.section variants={item}>
            <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("result.advice")}</h3>
            {tr.status === "loading" ? (
              <div className="space-y-2" aria-live="polite">
                <p className="text-sm text-muted-foreground">{t("result.translating")}</p>
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <>
                {tr.status === "error" && <p className="mb-2 text-xs text-muted-foreground">{t("result.noTranslation")}</p>}
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{tr.advisory}</p>
              </>
            )}
          </motion.section>
        )}

        {report.regenerativeTip && (
          <motion.section variants={item} className="rounded-xl border border-primary/25 bg-primary/5 p-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sprout className="size-4" /> {t("result.regenerativeTip")}
            </h3>
            {tr.status === "loading" ? (
              <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-muted" />
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed">{tr.regenerativeTip}</p>
            )}
          </motion.section>
        )}

        {cls && (
          <motion.section
            variants={item}
            className={
              uncertain
                ? "rounded-xl border border-severity-medium/40 bg-severity-medium/5 p-3.5"
                : "rounded-xl border bg-background p-3.5"
            }
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Cpu className={uncertain ? "size-4 text-severity-medium" : "size-4 text-primary"} /> {t("result.model.title")}
            </h3>
            {uncertain ? (
              <>
                <p className="mt-2 text-sm text-severity-medium">{t(uncertainMessageKey)}</p>
                {/* The raw guess stays visible, but clearly secondary. */}
                <p className="mt-2 text-xs text-muted-foreground">
                  {cls.crop}
                  {cls.condition ? ` · ${cls.condition}` : ""} — {Math.round(cls.confidence * 100)}%
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-lg font-medium">
                  {cls.crop}
                  {cls.condition && <span className="text-muted-foreground">·</span>}
                  {cls.condition}
                  <span className="text-sm font-normal text-muted-foreground">{Math.round(cls.confidence * 100)}%</span>
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {cls.top3.slice(1).map((c) => (
                    <li key={c.label}>
                      {c.label} — {Math.round(c.confidence * 100)}%
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">{t("result.model.note")}</p>
              </>
            )}
          </motion.section>
        )}

        <motion.div variants={item}>
          <FollowUpBox reportId={report.id} />
        </motion.div>

        <motion.div variants={item} className="flex flex-wrap gap-2 pt-1">
          {onAnother && (
            <button
              onClick={onAnother}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <RotateCcw className="size-4" /> {t("result.another")}
            </button>
          )}
          <Link
            href={`/map?focus=${report.id}`}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <MapPin className="size-4" /> {t("result.onMap")}
          </Link>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            {copied ? <Check className="size-4 text-primary" /> : <Link2 className="size-4" />}
            {copied ? t("result.copied") : t("result.share")}
          </button>
        </motion.div>
      </div>
      </div>
    </motion.article>
  );
}
