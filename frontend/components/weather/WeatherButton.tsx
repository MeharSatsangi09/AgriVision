"use client";
import { useMemo } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudRainWind, CloudSnow, CloudSun, Loader2, Moon, Sun, X, Droplets, Thermometer, Wind } from "lucide-react";
import { MorphingPopover, MorphingPopoverContent, MorphingPopoverTrigger, usePopoverClose } from "@/components/core/morphing-popover";
import { useWeather } from "@/lib/WeatherProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LOCALES, type Condition, type WeatherKind } from "@/lib/weather";
import { cn } from "@/lib/utils";

type Icon = typeof Sun;
function iconFor(kind: WeatherKind, isDay: boolean): Icon {
  switch (kind) {
    case "clear": return isDay ? Sun : Moon;
    case "partly": return isDay ? CloudSun : CloudMoon;
    case "fog": return CloudFog;
    case "drizzle": return CloudDrizzle;
    case "rain": return CloudRain;
    case "showers": return CloudRainWind;
    case "thunder": return CloudLightning;
    case "snow": return CloudSnow;
    default: return Cloud;
  }
}
const tone = (kind: WeatherKind, isDay: boolean) =>
  kind === "clear" && isDay ? "text-amber-500" : kind === "thunder" ? "text-violet-600" : kind === "clear" || kind === "partly" ? "text-primary" : "text-slate-500";

const PREVIEWS: { id: string; c: Condition; key: string }[] = [
  { id: "sun", c: { kind: "clear", isDay: true }, key: "weather.cond.clear" },
  { id: "night", c: { kind: "clear", isDay: false }, key: "weather.cond.clearNight" },
  { id: "cloud", c: { kind: "cloudy", isDay: true }, key: "weather.cond.cloudy" },
  { id: "fog", c: { kind: "fog", isDay: true }, key: "weather.cond.fog" },
  { id: "drizzle", c: { kind: "drizzle", isDay: true }, key: "weather.cond.drizzle" },
  { id: "rain", c: { kind: "rain", isDay: true }, key: "weather.cond.rain" },
  { id: "storm", c: { kind: "thunder", isDay: true }, key: "weather.cond.thunder" },
  { id: "snow", c: { kind: "snow", isDay: true }, key: "weather.cond.snow" },
];

// Header weather control: a pill with today's icon + temperature that morphs into a card: now, today hour by hour,
// and the next 7 days. The card also has a "preview" row that switches the whole-site weather effects, which is how
// every kind of weather can be shown on demand (for a demo, or when it is sunny outside).
export default function WeatherButton() {
  const { t, lang } = useI18n();
  const { weather, status, usingDefault, condition, preview, setPreview, reload } = useWeather();
  const locale = LOCALES[lang] ?? "en-IN";
  const hourFmt = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric" }), [locale]);
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" }), [locale]);
  const deg = (n: number) => `${Math.round(n)}°`;
  const label = (c: Condition) =>
    t(c.kind === "clear" ? (c.isDay ? "weather.cond.clear" : "weather.cond.clearNight") : `weather.cond.${c.kind}`);

  const shown = condition ?? { kind: "cloudy" as const, isDay: true };
  const Now = iconFor(shown.kind, shown.isDay);
  const cur = weather?.current;

  return (
    <MorphingPopover className="static sm:relative">
      <MorphingPopoverTrigger
        radius={20}
        className="flex h-10 items-center gap-1.5 rounded-full border border-primary/15 bg-white/60 px-3 text-sm font-medium text-primary shadow-sm backdrop-blur-md transition-all duration-300 hover:border-primary/60 hover:bg-primary/10 hover:shadow-[0_0_18px_4px_rgba(47,107,58,0.4)]"
      >
        <span className="sr-only">{t("weather.label")}</span>
        {status === "loading" && !weather ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Now className={cn("size-5", tone(shown.kind, shown.isDay))} aria-hidden />}
        {cur && <span className="tabular-nums">{deg(cur.temp)}</span>}
      </MorphingPopoverTrigger>

      <MorphingPopoverContent
        radius={20}
        closeOnContentClick={false}
        className="left-3 right-3 top-[3.75rem] max-h-[calc(100dvh-4.5rem)] overflow-y-auto bg-gradient-to-br from-[#e3f3d6] via-white to-[#eef7e8] p-4 sm:left-auto sm:right-0 sm:top-0 sm:w-[25rem]"
      >
        <PopoverClose label={t("common.close")} />

        {status === "error" && !weather ? (
          <div className="space-y-3 py-6 text-center text-sm">
            <p className="text-muted-foreground">{t("weather.error")}</p>
            <button type="button" onClick={reload} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              {t("weather.retry")}
            </button>
          </div>
        ) : !weather || !cur ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("weather.loading")}
          </p>
        ) : (
          <div className="space-y-4">
            {/* now */}
            <div>
              <p className="pr-8 text-xs text-muted-foreground">{usingDefault ? t("weather.locDefault") : t("weather.locYours")}</p>
              <div className="mt-1 flex items-center gap-3">
                <Now className={cn("size-12 shrink-0", tone(shown.kind, shown.isDay))} aria-hidden />
                <div>
                  <div className="text-4xl font-semibold leading-none tracking-tight">{deg(cur.temp)}C</div>
                  <div className="mt-1 text-sm text-muted-foreground">{label(cur.condition)}</div>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat icon={Thermometer} label={t("weather.feels")} value={deg(cur.feels)} />
                <Stat icon={Droplets} label={t("weather.humidity")} value={`${Math.round(cur.humidity)}%`} />
                <Stat icon={Wind} label={t("weather.wind")} value={`${Math.round(cur.wind)} km/h`} />
              </dl>
            </div>

            {/* today, hour by hour */}
            {weather.hours.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("weather.today")}</h3>
                <ul data-lenis-prevent className="flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:thin]">
                  {weather.hours.map((h, i) => {
                    const I = iconFor(h.condition.kind, h.condition.isDay);
                    return (
                      <li key={h.time} className="flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-xl bg-white/70 px-1 py-2 text-center">
                        <span className="text-[11px] text-muted-foreground">{i === 0 ? t("weather.now") : hourFmt.format(new Date(h.time))}</span>
                        <I className={cn("size-5", tone(h.condition.kind, h.condition.isDay))} aria-hidden />
                        <span className="text-sm font-medium tabular-nums">{deg(h.temp)}</span>
                        <span className="text-[10px] tabular-nums text-sky-600">{Math.round(h.rainChance)}%</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* next 7 days */}
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("weather.week")}</h3>
              <ul className="space-y-1">
                {weather.days.map((d, i) => {
                  const I = iconFor(d.kind, true);
                  return (
                    <li key={d.date} className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-1.5 text-sm">
                      <span className="w-20 shrink-0 truncate">{i === 0 ? t("weather.todayShort") : i === 1 ? t("weather.tomorrow") : dayFmt.format(new Date(`${d.date}T00:00`))}</span>
                      <I className={cn("size-5 shrink-0", tone(d.kind, true))} aria-hidden />
                      <span className="w-10 shrink-0 text-xs tabular-nums text-sky-600">{Math.round(d.rainChance)}%</span>
                      <span className="ml-auto tabular-nums">
                        <span className="text-muted-foreground">{deg(d.min)}</span> <span className="font-medium">{deg(d.max)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* preview the site effects */}
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("weather.preview")}</h3>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={!preview} onClick={() => setPreview(null)}>{t("weather.previewLive")}</Chip>
                {PREVIEWS.map((p) => (
                  <Chip key={p.id} active={!!preview && preview.kind === p.c.kind && preview.isDay === p.c.isDay} onClick={() => setPreview(p.c)}>
                    {t(p.key)}
                  </Chip>
                ))}
              </div>
            </section>

            <p className="text-[11px] text-muted-foreground">{t("weather.source")}</p>
          </div>
        )}
      </MorphingPopoverContent>
    </MorphingPopover>
  );
}

function Stat({ icon: I, label, value }: { icon: Icon | typeof Thermometer; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/70 px-2 py-1.5">
      <dt className="flex items-center gap-1 text-muted-foreground"><I className="size-3" aria-hidden /> {label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-white/70 text-primary hover:bg-primary/10"
      )}
    >
      {children}
    </button>
  );
}

// The card has its own controls, so it closes with this button (or Esc, or a click outside).
function PopoverClose({ label }: { label: string }) {
  const close = usePopoverClose();
  return (
    <button
      type="button"
      onClick={close}
      aria-label={label}
      title={label}
      className="absolute right-2.5 top-2.5 z-10 grid size-6 place-items-center rounded-full border border-severity-high/30 bg-severity-high/10 text-severity-high transition hover:scale-110 hover:bg-severity-high/25"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}
