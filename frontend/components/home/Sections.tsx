"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Camera, ChevronRight, ScanSearch, TriangleAlert, Bell } from "lucide-react";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { groupOutbreaks, useData } from "@/lib/data";
import { useSeen } from "@/lib/seen";
import { cn } from "@/lib/utils";

// Scroll-reveal container/item pair shared by the sections below (same pattern as ResultPanel's stagger).
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export function Hero() {
  const { t } = useI18n();
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 text-primary-foreground md:px-12 md:py-16"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 size-96 rounded-full bg-black/10 blur-3xl" />
      <div className="relative max-w-2xl">
        <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-5xl">{t("hero.title")}</h1>
        <p className="mt-4 text-base text-primary-foreground/85 md:text-lg">{t("hero.subtitle")}</p>
      </div>
    </motion.section>
  );
}

// Compact outbreak strip, shown while at least one outbreak is active. Red while there is something this viewer
// hasn't seen yet; once they have opened the Alerts page it stays as a quiet link (the outbreak is still real).
export function AlertStrip() {
  const { t } = useI18n();
  const { active, unseenCount } = useSeen();
  const n = active.length;
  if (!n) return null;
  const quiet = unseenCount === 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Link
        href="/alerts"
        className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3 transition",
          quiet
            ? "bg-card text-muted-foreground hover:bg-muted"
            : "border-severity-high/30 bg-severity-high/10 text-severity-high hover:bg-severity-high/15"
        )}
      >
        <TriangleAlert className="size-5 shrink-0" />
        <span className="font-medium">
          {n} {t("home.outbreaks")}
        </span>
        {!quiet && (
          <span className="rounded-full bg-severity-high px-2 py-0.5 text-xs font-semibold text-white">{t("alerts.new")}</span>
        )}
        <ChevronRight className="ml-auto size-5" />
      </Link>
    </motion.div>
  );
}

export function Stats() {
  const { t } = useI18n();
  const { reports } = useData();
  const outbreaks = groupOutbreaks(reports).length;
  const tiles = [
    { label: t("home.reports"), value: reports.length, tone: "text-primary" },
    { label: t("home.outbreaks"), value: outbreaks, tone: outbreaks ? "text-severity-high" : "text-primary" },
  ];
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      variants={container}
      className="grid grid-cols-2 gap-4"
    >
      {tiles.map((s) => (
        <motion.div key={s.label} variants={item} className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className={`flex items-baseline text-4xl font-bold ${s.tone}`}>
            <SlidingNumber number={s.value} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: Camera, title: t("home.h1t"), body: t("home.h1d") },
    { icon: ScanSearch, title: t("home.h2t"), body: t("home.h2d") },
    { icon: Bell, title: t("home.h3t"), body: t("home.h3d") },
  ];
  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">{t("home.how")}</h2>
      <motion.ol
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={container}
        className="grid gap-4 md:grid-cols-3"
      >
        {steps.map(({ icon: Icon, title, body }, i) => (
          <motion.li key={title} variants={item} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
