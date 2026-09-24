"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Activity, ArrowUpRight, Bell, Camera, Check, ChevronRight, Leaf, MapPin, ScanSearch, ShieldCheck, TriangleAlert } from "lucide-react";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { groupOutbreaks, useData } from "@/lib/data";
import { useSeen } from "@/lib/seen";
import { cn } from "@/lib/utils";
import { AnimatedBackground } from "@/components/core/animated-background";

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
  const [signal, setSignal] = useState<"leaf" | "field" | "advice">("leaf");
  const signals = [
    { id: "leaf" as const, label: "Leaf health", icon: Leaf },
    { id: "field" as const, label: "Field signals", icon: Activity },
    { id: "advice" as const, label: "Local advice", icon: ShieldCheck },
  ];

  const signalContent = {
    leaf: {
      eyebrow: "VISUAL CHECK",
      title: "A clearer read on every leaf",
      detail: "One close-up photo becomes a practical next step for the field.",
      value: "92%",
      label: "signal confidence",
      color: "bg-primary",
    },
    field: {
      eyebrow: "FIELD PULSE",
      title: "See patterns before they spread",
      detail: "Nearby reports turn isolated symptoms into an early warning.",
      value: "24 km",
      label: "signal radius",
      color: "bg-severity-high",
    },
    advice: {
      eyebrow: "FARMER READY",
      title: "Advice that meets the moment",
      detail: "Get a simple explanation and treatment guidance in your language.",
      value: "12",
      label: "supported languages",
      color: "bg-severity-medium",
    },
  }[signal];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[2rem] bg-[#173d24] px-6 py-8 text-white shadow-[0_24px_70px_-30px_rgba(23,61,36,0.8)] md:px-10 md:py-10"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full border border-white/10" />
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 size-64 rounded-full border border-white/10" />

      <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="max-w-2xl">
          <div className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#b8d8b7]">
            <span className="grid size-8 place-items-center rounded-full bg-white/10"><Leaf className="size-4" /></span>
            Crop intelligence for the field
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">{t("hero.title")}</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70 md:text-lg">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#upload" className="inline-flex items-center gap-2 rounded-full bg-[#e5f0df] px-5 py-3 text-sm font-semibold text-[#173d24] transition hover:bg-white">
              {t("upload.submit")} <ArrowUpRight className="size-4" />
            </a>
            <Link href="/map" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Explore field signals <MapPin className="size-4" />
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            <span className="flex items-center gap-2"><Check className="size-4 text-[#b8d8b7]" /> Photo-first diagnosis</span>
            <span className="flex items-center gap-2"><Check className="size-4 text-[#b8d8b7]" /> Localized advice</span>
          </div>
        </div>

        <div className="relative rounded-[1.5rem] border border-white/15 bg-[#edf3e7] p-3 text-[#173d24] shadow-2xl shadow-black/20 sm:p-4">
          <div className="flex items-center justify-between px-2 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#607461]">
            <span>AgriVision / live view</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#4d9d56]" /> Ready</span>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#dce8d8] p-1">
            {signals.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSignal(id)}
                className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition", signal === id ? "bg-white text-[#173d24] shadow-sm" : "text-[#607461] hover:text-[#173d24]")}
              >
                <Icon className="size-3.5" /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={signal}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="mt-3 rounded-xl bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#718172]">{signalContent.eyebrow}</p>
                  <h2 className="mt-3 max-w-xs text-2xl font-semibold leading-tight">{signalContent.title}</h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#68776a]">{signalContent.detail}</p>
                </div>
                <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl text-white", signalContent.color)}>
                  {signal === "leaf" ? <Leaf className="size-5" /> : signal === "field" ? <Activity className="size-5" /> : <ShieldCheck className="size-5" />}
                </div>
              </div>
              <div className="mt-7 grid grid-cols-[auto_1fr] items-end gap-4 border-t border-[#e2e9df] pt-4">
                <div>
                  <div className="text-3xl font-semibold tracking-tight">{signalContent.value}</div>
                  <div className="mt-1 text-xs text-[#718172]">{signalContent.label}</div>
                </div>
                <div className="flex h-10 items-end gap-1.5 justify-self-end" aria-hidden>
                  {[22, 34, 28, 48, 38, 57, 45, 68, 54, 76, 62, 82].map((height, index) => (
                    <motion.span key={index} initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ delay: index * 0.025, duration: 0.35 }} className="w-1.5 rounded-full bg-[#9cc39a]" />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center gap-2 px-2 pt-3 text-xs text-[#607461]"><ScanSearch className="size-3.5" /> Designed around a single clear field signal</div>
        </div>
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
    <AnimatedBackground
      defaultValue={tiles[0].label}
      enableHover
      className="grid grid-cols-2 gap-4"
      transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
    >
      {tiles.map((s) => (
        <motion.div
          key={s.label}
          data-id={s.label}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={item}
          className="rounded-2xl border bg-transparent p-5 shadow-sm"
        >
          <div className={`flex items-baseline text-4xl font-bold ${s.tone}`}>
            <SlidingNumber number={s.value} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
        </motion.div>
      ))}
    </AnimatedBackground>
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
      <AnimatedBackground
        defaultValue="0"
        enableHover
        className="grid gap-4 md:grid-cols-3"
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
      >
        {steps.map(({ icon: Icon, title, body }, i) => (
          <motion.div
            key={title}
            data-id={String(i)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={item}
            className="rounded-2xl border bg-transparent p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </motion.div>
        ))}
      </AnimatedBackground>
    </section>
  );
}
