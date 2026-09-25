"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useWeather } from "@/lib/WeatherProvider";
import type { Condition, WeatherKind } from "@/lib/weather";

// Full-page weather scene behind all content ("the canvas"): a sky gradient for the current weather plus animated
// effects: rain, lightning, sun glow, drifting clouds, fog, snow. Every sky stays light so the dark page text keeps its
// contrast. Sits at z-0 with pointer-events off; page content is layered above it. With "reduce motion" set in the
// operating system only the still sky is shown (no falling drops, no flashes).
const SKY: Record<WeatherKind, { day: string; night: string }> = {
  clear: {
    day: "linear-gradient(180deg, #f3fbd8 0%, #d3f1a3 45%, #b4e57a 100%)",
    night: "linear-gradient(180deg, #dfe8f3 0%, #c9dbe6 55%, #b9d3d0 100%)",
  },
  partly: {
    day: "linear-gradient(180deg, #eef8dd 0%, #cfeaa9 55%, #b7dd8f 100%)",
    night: "linear-gradient(180deg, #dbe3ee 0%, #c8d5e0 60%, #bdd0cd 100%)",
  },
  cloudy: {
    day: "linear-gradient(180deg, #e6ece6 0%, #d3ddd3 55%, #c3d0c4 100%)",
    night: "linear-gradient(180deg, #dadfe6 0%, #ccd4dc 60%, #c0cbcb 100%)",
  },
  fog: {
    day: "linear-gradient(180deg, #e9eeeb 0%, #dde5e1 60%, #d2dcd7 100%)",
    night: "linear-gradient(180deg, #dde2e8 0%, #d3dae1 60%, #c9d3d5 100%)",
  },
  drizzle: {
    day: "linear-gradient(180deg, #dbe6ea 0%, #c9d9df 55%, #bccdcd 100%)",
    night: "linear-gradient(180deg, #d3dbe4 0%, #c3d0da 60%, #b8c8cb 100%)",
  },
  rain: {
    day: "linear-gradient(180deg, #d0dde5 0%, #bccdd8 55%, #adc2c7 100%)",
    night: "linear-gradient(180deg, #c9d3df 0%, #b8c7d5 60%, #aabfc4 100%)",
  },
  showers: {
    day: "linear-gradient(180deg, #c6d4de 0%, #b1c4d1 55%, #a2b9c0 100%)",
    night: "linear-gradient(180deg, #c0cbd8 0%, #aebfce 60%, #a0b6bc 100%)",
  },
  thunder: {
    day: "linear-gradient(180deg, #bdc6d4 0%, #a9b6c6 55%, #9dafb9 100%)",
    night: "linear-gradient(180deg, #b7c0cf 0%, #a5b2c4 60%, #97aab5 100%)",
  },
  snow: {
    day: "linear-gradient(180deg, #f1f6fa 0%, #e0ebf3 55%, #d2e2ea 100%)",
    night: "linear-gradient(180deg, #e0e7f0 0%, #d3dfea 60%, #c8d9df 100%)",
  },
};

const DROP_FACTOR: Partial<Record<WeatherKind, number>> = { drizzle: 0.45, rain: 1, showers: 1.5, thunder: 1.35 };

export default function WeatherBackdrop() {
  const { condition, weather } = useWeather();
  const reduced = !!useReducedMotion();
  if (!condition) return null;
  const key = `${condition.kind}-${condition.isDay ? "d" : "n"}`;
  const wind = weather?.windSpeed ?? 8;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <AnimatePresence>
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{ background: SKY[condition.kind][condition.isDay ? "day" : "night"] }}
        >
          <Scene condition={condition} wind={wind} reduced={reduced} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Scene({ condition, wind, reduced }: { condition: Condition; wind: number; reduced: boolean }) {
  const { kind, isDay } = condition;
  const sunny = (kind === "clear" || kind === "partly") && isDay;
  const moon = (kind === "clear" || kind === "partly") && !isDay;
  const grey = kind === "cloudy" || kind === "drizzle" || kind === "rain" || kind === "showers" || kind === "thunder";
  const precip = kind in DROP_FACTOR || kind === "snow";
  return (
    <>
      {sunny && <SunGlow reduced={reduced} strong={kind === "clear"} />}
      {moon && <MoonGlow />}
      {(kind === "partly" || grey || kind === "snow") && (
        <Clouds tone={kind === "thunder" || kind === "showers" ? "dark" : grey ? "grey" : "white"} count={kind === "partly" ? 3 : 5} reduced={reduced} />
      )}
      {kind === "fog" && <Haze reduced={reduced} />}
      {precip && !reduced && <PrecipCanvas kind={kind} wind={wind} />}
    </>
  );
}

function SunGlow({ reduced, strong }: { reduced: boolean; strong: boolean }) {
  return (
    <>
      <motion.div
        className="absolute -right-32 -top-32 size-[44rem] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,226,110,0.95) 0%, rgba(255,236,150,0.55) 32%, rgba(255,240,170,0) 66%)", opacity: strong ? 1 : 0.65 }}
        animate={reduced ? undefined : { scale: [1, 1.07, 1], opacity: strong ? [0.9, 1, 0.9] : [0.55, 0.7, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* slowly turning rays */}
      <motion.div
        className="absolute -right-[22rem] -top-[22rem] size-[60rem] rounded-full opacity-25"
        style={{
          background: "repeating-conic-gradient(from 0deg, rgba(255,240,160,0.9) 0deg 6deg, transparent 6deg 18deg)",
          maskImage: "radial-gradient(circle, black 0%, transparent 62%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 62%)",
        }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 160, repeat: Infinity, ease: "linear" }}
      />
    </>
  );
}

function MoonGlow() {
  return (
    <div
      className="absolute -right-24 -top-24 size-[30rem] rounded-full"
      style={{ background: "radial-gradient(circle, rgba(255,255,240,0.85) 0%, rgba(230,240,255,0.45) 35%, rgba(230,240,255,0) 68%)" }}
    />
  );
}

// A few big blurred puffs drifting slowly across the sky (pure CSS/motion, cheap).
function Clouds({ tone, count, reduced }: { tone: "white" | "grey" | "dark"; count: number; reduced: boolean }) {
  const color = tone === "white" ? "255,255,255" : tone === "grey" ? "150,165,175" : "88,102,120";
  const alpha = tone === "white" ? 0.7 : tone === "grey" ? 0.5 : 0.55;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const top = 2 + ((i * 17) % 46);
        const w = 22 + ((i * 7) % 16);
        const from = -30 - i * 6;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full blur-3xl"
            style={{ top: `${top}%`, left: `${(i * 23) % 80}%`, width: `${w}rem`, height: `${w * 0.32}rem`, background: `rgba(${color},${alpha})` }}
            initial={{ x: `${from}vw` }}
            animate={reduced ? { x: "0vw" } : { x: ["-20vw", "110vw"] }}
            transition={reduced ? undefined : { duration: 90 + i * 22, repeat: Infinity, ease: "linear", delay: -i * 24 }}
          />
        );
      })}
    </>
  );
}

function Haze({ reduced }: { reduced: boolean }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute -left-1/4 h-56 w-[150%] rounded-full bg-white/60 blur-3xl"
          style={{ top: `${18 + i * 26}%` }}
          animate={reduced ? undefined : { x: ["-6%", "8%", "-6%"] }}
          transition={{ duration: 28 + i * 8, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

interface Drop { x: number; y: number; len: number; speed: number; alpha: number }
interface Flake { x: number; y: number; r: number; speed: number; sway: number; phase: number }

// Rain / drizzle / storm / snow on one canvas, plus lightning for storms.
function PrecipCanvas({ kind, wind }: { kind: WeatherKind; wind: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0;
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);

    const snow = kind === "snow";
    const factor = DROP_FACTOR[kind] ?? 1;
    const count = snow ? 90 : Math.round(Math.min(260, Math.max(70, (w * h) / 8000)) * factor);
    const slant = Math.min(0.32, 0.06 + wind / 130); // horizontal lean of falling rain from the wind
    const drops: Drop[] = [];
    const flakes: Flake[] = [];
    for (let i = 0; i < count; i++) {
      if (snow) flakes.push({ x: Math.random() * w, y: Math.random() * h, r: 1.6 + Math.random() * 2.2, speed: 28 + Math.random() * 45, sway: 8 + Math.random() * 18, phase: Math.random() * 6.28 });
      else drops.push({ x: Math.random() * w, y: Math.random() * h, len: (kind === "drizzle" ? 6 : 12) + Math.random() * (kind === "drizzle" ? 6 : 14), speed: (kind === "drizzle" ? 520 : 900) + Math.random() * 500, alpha: 0.22 + Math.random() * 0.4 });
    }

    // Lightning (storms only): a jagged bolt and a soft white flash, at most one event every 6-14 s, at most two pulses.
    let bolt: { pts: [number, number][]; born: number } | null = null;
    let flashAt: number[] = [];
    let nextStrike = performance.now() + 2500 + Math.random() * 4000;
    const strike = (now: number) => {
      const x0 = w * (0.15 + Math.random() * 0.7);
      const pts: [number, number][] = [[x0, 0]];
      let x = x0, y = 0;
      const bottom = h * (0.45 + Math.random() * 0.3);
      while (y < bottom) {
        y += 22 + Math.random() * 40;
        x += (Math.random() - 0.5) * 70;
        pts.push([x, y]);
      }
      bolt = { pts, born: now };
      flashAt = [now, now + 130];
      nextStrike = now + 6000 + Math.random() * 8000;
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);

      if (snow) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.strokeStyle = "rgba(140,165,190,0.55)";
        ctx.lineWidth = 1;
        for (const f of flakes) {
          f.y += f.speed * dt;
          f.phase += dt;
          const x = f.x + Math.sin(f.phase) * f.sway;
          if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
          ctx.beginPath();
          ctx.arc(x, f.y, f.r, 0, 6.283);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.lineWidth = kind === "drizzle" ? 1 : 1.3;
        ctx.lineCap = "round";
        for (const d of drops) {
          d.y += d.speed * dt;
          d.x += d.speed * dt * slant;
          if (d.y > h + 20) { d.y = -20 - Math.random() * 60; d.x = Math.random() * (w + h * slant) - h * slant; }
          ctx.strokeStyle = `rgba(62,96,128,${d.alpha})`;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * slant, d.y - d.len);
          ctx.stroke();
        }
      }

      if (kind === "thunder") {
        if (now >= nextStrike) strike(now);
        // soft white flash (kept gentle)
        let flash = 0;
        for (const t of flashAt) { const age = now - t; if (age >= 0 && age < 360) flash = Math.max(flash, 0.3 * (1 - age / 360)); }
        if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, w, h); }
        if (bolt) {
          const age = now - bolt.born;
          if (age > 260) bolt = null;
          else {
            const a = 1 - age / 260;
            ctx.lineJoin = "round";
            ctx.shadowColor = `rgba(190,215,255,${a})`;
            ctx.shadowBlur = 18;
            ctx.strokeStyle = `rgba(255,255,255,${a})`;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            bolt.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, [kind, wind]);

  return <canvas ref={ref} className="absolute inset-0 size-full" />;
}
