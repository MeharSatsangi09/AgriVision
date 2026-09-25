"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Activity, ArrowUpRight, Bell, Camera, Check, ChevronRight, Leaf, MapPin, ScanSearch, ShieldCheck, TriangleAlert } from "lucide-react";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";
import { MorphingPopover, MorphingPopoverContent, MorphingPopoverTrigger } from "@/components/core/morphing-popover";
import { Spotlight } from "@/components/core/spotlight";
import { timeAgo, titleCase } from "@/lib/format";
import { reportUsername } from "@/lib/username";
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
  const [signal, setSignal] = useState<"leaf" | "field" | "advice">("leaf");
  const signals = [
    { id: "leaf" as const, label: "Leaf health", icon: Leaf },
    { id: "field" as const, label: "Field signals", icon: Activity },
    { id: "advice" as const, label: "Local advice", icon: ShieldCheck },
  ];

  const allContent = {
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
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[2rem] bg-[#173d24] px-6 py-8 text-white shadow-[0_24px_70px_-30px_rgba(23,61,36,0.8)] md:px-10 md:py-10"
    >
      {/* A living background, not a flat color — but a slow lateral drift (no zoom) so it reads differently
          from LivingFieldLanding's Ken Burns scenes. The image is sized wider than its box so panning never
          reveals an edge. */}
      <motion.img
        aria-hidden
        src="/healthy-leaf.jpg"
        alt=""
        className="pointer-events-none absolute inset-y-0 left-[-15%] h-full w-[130%] max-w-none object-cover"
        animate={{ x: ["-4%", "4%", "-4%"] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#173d24]/90 via-[#173d24]/80 to-[#0f2617]/95" />
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
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="inline-flex">
              <a
                href="#upload"
                className="group inline-flex items-center gap-2 rounded-full bg-[#e5f0df] px-5 py-3 text-sm font-semibold text-[#173d24] shadow-[0_0_0_0_rgba(229,240,223,0)] transition-all duration-300 hover:bg-white hover:shadow-[0_10px_30px_-6px_rgba(229,240,223,0.55)]"
              >
                {t("upload.submit")} <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 20 }} className="inline-flex">
              <Link
                href="/map"
                className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:border-white/70 hover:bg-white/15 hover:shadow-[0_0_24px_-2px_rgba(255,255,255,0.3)]"
              >
                Explore field signals <MapPin className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
              </Link>
            </motion.div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            {["Photo-first diagnosis", "Localized advice"].map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 font-medium text-white shadow-sm backdrop-blur-sm"
              >
                <Check className="size-4 text-[#c9e8c6]" /> {feature}
              </span>
            ))}
          </div>
        </div>

        <div className="relative rounded-[1.5rem] border border-white/40 bg-[#edf3e7]/70 p-3 text-[#173d24] shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-4">
          <div className="flex items-center justify-between px-2 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#2f4a34]">
            <span>AgriVision / live view</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 animate-pulse rounded-full bg-[#4d9d56]" /> Ready</span>
          </div>

          {/* Tab dock: a shared pill slides between tabs (layoutId), tabs lift on hover, icons pop on select. */}
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/40 bg-white/30 p-1 backdrop-blur-md" role="tablist">
            {signals.map(({ id, label, icon: Icon }) => {
              const active = signal === id;
              return (
                <motion.button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSignal(id)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  className={cn(
                    "relative flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors",
                    active ? "text-[#173d24]" : "text-[#173d24]/70 hover:text-[#173d24]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="signal-pill"
                      className="absolute inset-0 rounded-lg border border-white/70 bg-white/75 shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <motion.span className="relative" animate={active ? { scale: [1, 1.25, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }} transition={{ duration: 0.4 }}>
                    <Icon className="size-3.5" />
                  </motion.span>
                  <span className="relative hidden sm:inline">{label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* All three panels share one grid cell, so the box is always the tallest panel's size and switching
              tabs is a cross-fade with no layout jump. */}
          <div className="mt-3 grid">
            {signals.map(({ id, icon: Icon }) => {
              const c = allContent[id];
              const active = signal === id;
              return (
                <motion.div
                  key={id}
                  aria-hidden={!active}
                  animate={{ opacity: active ? 1 : 0, y: active ? 0 : 8, scale: active ? 1 : 0.98 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={cn(
                    "col-start-1 row-start-1 flex flex-col rounded-xl border border-white/60 bg-white/55 p-5 shadow-sm backdrop-blur-md sm:p-6",
                    !active && "pointer-events-none"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4a5f4d]">{c.eyebrow}</p>
                      <h2 className="mt-3 max-w-xs text-2xl font-semibold leading-tight">{c.title}</h2>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-[#3f5443]">{c.detail}</p>
                    </div>
                    <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl text-white", c.color)}>
                      <Icon className="size-5" />
                    </div>
                  </div>
                  <div className="mt-auto grid grid-cols-[auto_1fr] items-end gap-4 border-t border-[#173d24]/10 pt-4">
                    <div>
                      <div className="text-3xl font-semibold tracking-tight">{c.value}</div>
                      <div className="mt-1 text-xs text-[#4a5f4d]">{c.label}</div>
                    </div>
                    <div className="flex h-10 items-end gap-1.5 justify-self-end" aria-hidden>
                      {[22, 34, 28, 48, 38, 57, 45, 68, 54, 76, 62, 82].map((height, index) => (
                        <motion.span
                          key={index}
                          initial={false}
                          animate={{ height: active ? `${height}%` : "10%" }}
                          transition={{ delay: active ? index * 0.025 : 0, duration: 0.35 }}
                          className="w-1.5 rounded-full bg-[#5f9a63]"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-2 pt-3 text-xs text-[#2f4a34]"><ScanSearch className="size-3.5" /> Designed around a single clear field signal</div>
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
          "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
          quiet
            ? "bg-card text-muted-foreground hover:bg-muted"
            : "border-severity-high/30 bg-severity-high/10 text-severity-high hover:bg-severity-high/15 hover:border-severity-high hover:shadow-[0_0_0_1px_rgba(200,64,47,0.5),0_0_28px_6px_rgba(200,64,47,0.4)]"
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


const TILE =
  "rounded-2xl border border-primary/20 bg-gradient-to-br from-[#d5ebd0] via-white to-[#e6f3e2] p-5 shadow-sm transition-[box-shadow,border-color] duration-300 ease-out hover:border-primary/30 hover:shadow-[0_0_18px_3px_rgba(47,107,58,0.22)]";

const SEV_DOT = { low: "bg-severity-low", medium: "bg-severity-medium", high: "bg-severity-high" } as const;

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
      </span>
      Live
    </span>
  );
}

// Both tiles read the same realtime Firestore snapshot (DataProvider), so the numbers and the
// popover contents update the moment a new report or outbreak is written by the backend.
export function Stats() {
  const { t, lang } = useI18n();
  const { reports } = useData();
  const outbreaks = groupOutbreaks(reports);
  const sev = (s: "low" | "medium" | "high") => reports.filter((r) => r.diagnosis.severity === s).length;
  const name = (r: (typeof reports)[number]) => r.diseaseTranslations?.[lang] ?? titleCase(r.diagnosis.disease);

  return (
    <div className="grid grid-cols-2 gap-4">
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={item}>
        <MorphingPopover>
          <MorphingPopoverTrigger className={TILE}>
            <div className="flex items-baseline text-4xl font-bold text-primary">
              <SlidingNumber number={reports.length} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("home.reports")}</p>
          </MorphingPopoverTrigger>
          <MorphingPopoverContent className="w-[min(22rem,calc(100vw-2rem))] bg-gradient-to-br from-[#d5ebd0] via-white to-[#e6f3e2] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{t("home.reports")}</h3>
              <LiveBadge />
            </div>
            <div className="mb-3 flex gap-3 text-xs text-muted-foreground">
              {(["high", "medium", "low"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", SEV_DOT[s])} /> {sev(s)} {s}
                </span>
              ))}
            </div>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            ) : (
              <ul className="space-y-2">
                {reports.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <Link href={`/report/${r.id}`} className="flex items-center gap-3 rounded-xl bg-white/60 p-2 text-sm transition-colors hover:bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.photoUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("size-2 shrink-0 rounded-full", SEV_DOT[r.diagnosis.severity])} />
                          <span className="truncate font-medium">{name(r)}</span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t("reports.by")} {reportUsername(r.id)} · {timeAgo(r.timestamp, lang)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                {t("reports.viewAll")} <ChevronRight className="size-4" />
              </Link>
              <Link href="/map" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline">
                <MapPin className="size-3" /> {t("nav.map")}
              </Link>
            </div>
          </MorphingPopoverContent>
        </MorphingPopover>
      </motion.div>

      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={item}>
        <MorphingPopover>
          <MorphingPopoverTrigger className={TILE}>
            <div className={cn("flex items-baseline text-4xl font-bold", outbreaks.length ? "text-severity-high" : "text-primary")}>
              <SlidingNumber number={outbreaks.length} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("home.outbreaks")}</p>
          </MorphingPopoverTrigger>
          <MorphingPopoverContent className="right-0 left-auto w-[min(22rem,calc(100vw-2rem))] bg-gradient-to-br from-[#d5ebd0] via-white to-[#e6f3e2] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{t("home.outbreaks")}</h3>
              <LiveBadge />
            </div>
            {outbreaks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active outbreaks. Nearby reports are being watched.</p>
            ) : (
              <ul className="space-y-2">
                {outbreaks.slice(0, 4).map((o) => (
                  <li key={o.key} className="rounded-lg border border-severity-high/25 bg-severity-high/10 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{o.latest.diseaseTranslations?.[lang] ?? titleCase(o.disease)}</span>
                      <span className="shrink-0 text-xs text-severity-high">
                        {o.reports.length} reports{o.high ? ` · ${o.high} high` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(o.latest.timestamp, lang)}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/alerts" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Open alerts <ChevronRight className="size-4" />
            </Link>
          </MorphingPopoverContent>
        </MorphingPopover>
      </motion.div>
    </div>
  );
}

export function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: Camera, title: t("home.h1t"), body: t("home.h1d") },
    { icon: ScanSearch, title: t("home.h2t"), body: t("home.h2d") },
    { icon: Bell, title: t("home.h3t"), body: t("home.h3d") },
  ];
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const [glow, setGlow] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [shown, setShown] = useState(false);

  // One glow box slides between cards. It animates real x/y/width/height (not a shared layoutId),
  // so it never gets stretched and always matches the card's rounded corners.
  const moveTo = (i: number) => {
    const el = cards.current[i];
    if (!el) return;
    setGlow({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    setShown(true);
  };

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#dcecd6] via-[#cfe5c8] to-[#bfdcb7] p-6 md:p-8">
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 size-72 rounded-full bg-white/50 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-10 size-80 rounded-full bg-primary/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(47,107,58,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(47,107,58,0.15)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">Three simple steps</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#173d24]">{t("home.how")}</h2>
      </div>
      <div className="relative grid gap-4 md:grid-cols-3" onMouseLeave={() => setShown(false)}>
        {glow && (
          <motion.div
            aria-hidden
            initial={false}
            animate={{ x: glow.x, y: glow.y, width: glow.w, height: glow.h, opacity: shown ? 1 : 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5, opacity: { duration: 0.25 } }}
            className="pointer-events-none absolute left-0 top-0 rounded-2xl shadow-[0_0_22px_4px_rgba(47,107,58,0.25)]"
          />
        )}
        {steps.map(({ icon: Icon, title, body }, i) => (
          <motion.div
            key={title}
            ref={(el) => {
              cards.current[i] = el;
            }}
            onMouseEnter={() => moveTo(i)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={item}
            className="relative z-10 h-full"
          >
            {/* Spotlight border: 1px padding shows the cursor-following glow around the inner card. */}
            <div className="relative h-full overflow-hidden rounded-2xl bg-primary/25 p-[2px]">
              <Spotlight className="blur-xl" size={170} />
              <div className="relative h-full rounded-[14px] bg-gradient-to-br from-[#eef7ea] via-white to-[#dff0da] p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
