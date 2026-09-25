"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { WeatherKind } from "@/lib/weather";

// The weather acts ON the page, not just behind it. This canvas sits above the cards (never blocks clicks) and reads the
// real position of every card on screen (outermost rounded panels inside <main> and the footer):
//  - Rain falls in depth layers. The far layer lives on the sky canvas behind the cards; this canvas holds the middle layer
//    (drops that hit card tops, splash and deflect, some stay as beads on the top edge, slide to a corner, run down the
//    card's side edge, hang from the bottom and drip off) and a few big near drops that streak past in front.
//  - Sun adds a subtle warm reflection on each card's top-right corner; it strengthens as a card nears the sun at the top-right
//    of the page, so the light moves from card to card as the page scrolls.
//  - Snow lands on card tops and settles for a few seconds.
//  - Thunderstorms flash the whole page softly when the sky canvas strikes.
// Off entirely when the OS asks for reduced motion.
const RAINY: Partial<Record<WeatherKind, number>> = { drizzle: 0.4, rain: 1, showers: 1.5, thunder: 1.3 };

export default function WeatherOverlay({ kind, isDay, wind }: { kind: WeatherKind; isDay: boolean; wind: number }) {
  const reduced = !!useReducedMotion();
  const sunny = isDay && (kind === "clear" || kind === "partly");
  const active = !reduced && (kind in RAINY || kind === "snow" || sunny);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={`${kind}-${isDay}`}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        >
          <OverlayCanvas kind={kind} sunny={sunny} wind={wind} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface Surf { el: Element; l: number; t: number; r: number; b: number; w: number; h: number }
interface Bead { u: number; r: number; dir: 1 | -1; speed: number }
interface Drip { side: "l" | "r"; yRel: number; vy: number; r: number; hang: number | null }
interface Rest { u: number; r: number; age: number; life: number }
interface SurfState { beads: Bead[]; drips: Drip[]; rest: Rest[] }
interface Fall { x: number; y: number; vx: number; vy: number; len: number; alpha: number; z: number }
interface Free { x: number; y: number; vy: number; r: number }
interface Part { x: number; y: number; vx: number; vy: number; age: number; max: number; r: number }
interface Ripple { x: number; y: number; age: number }

// Outermost rounded panels (cards) currently in the page.
function findCards(): Element[] {
  const cand: Element[] = [];
  document.querySelectorAll('main [class*="rounded"], footer [class*="rounded"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 130 || r.height < 40) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.3) return;
    if (!(parseFloat(cs.borderTopLeftRadius) >= 10)) return;
    const hasBg = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
    if (!(hasBg || cs.backgroundImage !== "none" || parseFloat(cs.borderTopWidth) > 0)) return;
    cand.push(el);
  });
  return cand.filter((el) => !cand.some((o) => o !== el && o.contains(el)));
}

function OverlayCanvas({ kind, sunny, wind }: { kind: WeatherKind; sunny: boolean; wind: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0, H = 0;
    const size = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);

    const intensity = RAINY[kind] ?? 0;
    const rainy = intensity > 0;
    const snow = kind === "snow";
    const slant = Math.min(0.3, 0.05 + wind / 140);
    const beadChance = Math.min(0.5, 0.3 * intensity);

    // ---- surfaces (cards) ---------------------------------------------------------------------------------------
    let cards: Element[] = [];
    let surfs: Surf[] = [];
    const states = new Map<Element, SurfState>();
    const stateOf = (el: Element) => {
      let s = states.get(el);
      if (!s) states.set(el, (s = { beads: [], drips: [], rest: [] }));
      return s;
    };
    const measure = () => {
      surfs = [];
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > H || r.width < 1) continue;
        surfs.push({ el, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height });
      }
    };
    cards = findCards();
    let lastScan = performance.now();

    // ---- rain & snow particles ----------------------------------------------------------------------------------
    const nMid = snow ? 70 : Math.round(Math.min(150, Math.max(55, (W * H) / 13000)) * intensity);
    const nNear = snow ? 0 : Math.round(14 * intensity);
    const falls: Fall[] = [];
    const nears: Fall[] = [];
    const frees: Free[] = [];
    const parts: Part[] = [];
    const ripples: Ripple[] = [];
    const resetFall = (f: Fall, initial: boolean) => {
      f.x = Math.random() * (W + H * slant) - H * slant * 0.5;
      f.y = initial ? Math.random() * H : -20 - Math.random() * 220;
    };
    for (let i = 0; i < nMid; i++) {
      const z = 0.55 + Math.random() * 0.3; // depth: nearer = bigger, faster, stronger
      const speed = snow ? 40 + z * 50 : (kind === "drizzle" ? 480 : 820) + z * 640;
      const f: Fall = { x: 0, y: 0, vx: snow ? 0 : speed * slant, vy: speed, len: snow ? 2 + z * 2.2 : 9 + z * 18, alpha: 0.28 + z * 0.35, z };
      resetFall(f, true);
      falls.push(f);
    }
    for (let i = 0; i < nNear; i++) {
      const speed = 1500 + Math.random() * 700;
      const f: Fall = { x: 0, y: 0, vx: speed * slant, vy: speed, len: 44 + Math.random() * 40, alpha: 0.12 + Math.random() * 0.1, z: 1 };
      resetFall(f, true);
      nears.push(f);
    }

    const impact = (x: number, s: Surf, f: { z?: number }) => {
      const st = stateOf(s.el);
      const z = f.z ?? 0.8;
      if (snow) {
        if (st.rest.length < 26) st.rest.push({ u: x - s.l, r: 1.6 + Math.random() * 2, age: 0, life: 5 + Math.random() * 5 });
        return;
      }
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        // deflect: small droplets thrown up and out
        parts.push({ x, y: s.t - 1, vx: (Math.random() - 0.5) * 170 + wind * 1.5, vy: -(50 + Math.random() * 120 * z), age: 0, max: 0.32 + Math.random() * 0.3, r: 0.7 + Math.random() * 1.1 });
      }
      ripples.push({ x, y: s.t, age: 0 });
      if (Math.random() < beadChance && st.beads.length < 12 && x > s.l + 4 && x < s.r - 4) {
        st.beads.push({ u: x - s.l, r: 1.6 + Math.random() * 1.8, dir: x < (s.l + s.r) / 2 ? -1 : 1, speed: 8 + Math.random() * 18 });
      }
    };

    // Returns the card this point would land on when moving from (x, y0) down to y1, or null; `inside` = already within a card.
    const land = (x: number, y0: number, y1: number): Surf | null => {
      let hit: Surf | null = null;
      for (const s of surfs) {
        if (x < s.l + 1 || x > s.r - 1) continue;
        if (y0 < s.t && y1 >= s.t && (!hit || s.t < hit.t)) hit = s;
      }
      return hit;
    };
    const insideAny = (x: number, y: number) => surfs.some((s) => x > s.l && x < s.r && y > s.t + 1 && y < s.b);

    // ---- lightning flash (the sky canvas fires this) ------------------------------------------------------------
    let flashAt: number[] = [];
    const onStrike = () => {
      const n = performance.now();
      flashAt = [n, n + 130];
    };
    window.addEventListener("weather-strike", onStrike);

    // ---- frame ----------------------------------------------------------------------------------------------------
    let raf = 0;
    let last = performance.now();
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = now / 1000;
      if (now - lastScan > 1200) {
        cards = findCards();
        lastScan = now;
      }
      measure();
      const alive = new Set(surfs.map((s) => s.el));
      for (const el of [...states.keys()]) if (!alive.has(el)) states.delete(el);
      const bySurf = new Map(surfs.map((s) => [s.el, s]));
      ctx.clearRect(0, 0, W, H);

      // ---- middle-plane rain / snow: falls, collides with card tops --------------------------------------------
      for (const f of falls) {
        const nx = f.x + f.vx * dt + (snow ? Math.sin(time * 1.3 + f.x) * 14 * dt : 0);
        const ny = f.y + f.vy * dt;
        const s = land(nx, f.y, ny);
        if (s) {
          impact(nx, s, f);
          resetFall(f, false);
          continue;
        }
        f.x = nx;
        f.y = ny;
        if (f.y > H + 20 || insideAny(f.x, f.y)) resetFall(f, false);
      }
      for (const f of frees) {
        f.vy = Math.min(900, f.vy + 700 * dt);
        const ny = f.y + f.vy * dt;
        const s = land(f.x, f.y, ny);
        if (s) {
          impact(f.x, s, { z: 0.6 });
          f.y = H + 100;
        } else f.y = ny;
      }
      for (let i = frees.length - 1; i >= 0; i--) if (frees[i].y > H + 40) frees.splice(i, 1);

      // draw falls
      if (snow) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.strokeStyle = "rgba(140,165,190,0.5)";
        ctx.lineWidth = 1;
        for (const f of falls) {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.len, 0, 6.283);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.lineCap = "round";
        for (const f of falls) {
          ctx.strokeStyle = `rgba(48,84,118,${f.alpha})`;
          ctx.lineWidth = 0.9 + f.z * 0.7;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x - f.len * slant, f.y - f.len);
          ctx.stroke();
        }
        // near plane: a few big soft streaks passing in front of everything (no collisions)
        ctx.shadowColor = "rgba(90,130,170,0.5)";
        ctx.shadowBlur = 5;
        ctx.lineWidth = 2.4;
        for (const f of nears) {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          if (f.y > H + 60) resetFall(f, false);
          ctx.strokeStyle = `rgba(70,105,140,${f.alpha})`;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x - f.len * slant, f.y - f.len);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
      for (const f of frees) {
        ctx.fillStyle = "rgba(225,238,250,0.85)";
        ctx.strokeStyle = "rgba(60,100,135,0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * 0.8, f.r * 1.3, 0, 0, 6.283);
        ctx.fill();
        ctx.stroke();
      }

      // ---- water sitting on cards: beads -> side drips -> hanging -> falling -------------------------------------
      for (const [el, st] of states) {
        const s = bySurf.get(el);
        if (!s) continue;
        for (let i = st.beads.length - 1; i >= 0; i--) {
          const b = st.beads[i];
          b.u += b.dir * b.speed * dt;
          b.speed *= 1 + 0.12 * dt;
          b.r = Math.min(3.8, b.r + 0.22 * dt);
          if (b.u <= 0 || b.u >= s.w) {
            st.drips.push({ side: b.u <= 0 ? "l" : "r", yRel: 0, vy: 25, r: b.r * 0.85, hang: null });
            st.beads.splice(i, 1);
          }
        }
        for (let i = st.drips.length - 1; i >= 0; i--) {
          const d = st.drips[i];
          if (d.hang === null) {
            d.vy = Math.min(250, d.vy + 240 * dt);
            d.yRel += d.vy * dt;
            if (d.yRel >= s.h) {
              d.yRel = s.h;
              d.hang = 0.5 + Math.random() * 0.9; // swells at the bottom edge for a moment
            }
          } else {
            d.hang -= dt;
            if (d.hang <= 0) {
              frees.push({ x: d.side === "l" ? s.l : s.r, y: s.b, vy: 90, r: d.r });
              st.drips.splice(i, 1);
            }
          }
        }
        for (let i = st.rest.length - 1; i >= 0; i--) {
          st.rest[i].age += dt;
          if (st.rest[i].age > st.rest[i].life) st.rest.splice(i, 1);
        }

        // draw: drips on the side edges
        for (const d of st.drips) {
          const x = d.side === "l" ? s.l : s.r;
          const y = s.t + d.yRel;
          const len = Math.min(d.yRel, 64);
          if (len > 1) {
            const g = ctx.createLinearGradient(x, y - len, x, y);
            g.addColorStop(0, "rgba(70,110,140,0)");
            g.addColorStop(1, "rgba(70,110,140,0.5)");
            ctx.strokeStyle = g;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, y - len);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          const stretch = d.hang !== null ? 1.25 + Math.min(0.5, (1 - Math.min(1, d.hang)) * 0.5) : 1.15;
          ctx.fillStyle = "rgba(228,240,252,0.88)";
          ctx.strokeStyle = "rgba(60,100,135,0.9)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x, y + d.r * 0.4, d.r * 0.85, d.r * stretch, 0, 0, 6.283);
          ctx.fill();
          ctx.stroke();
        }
        // beads sitting on the top edge
        for (const b of st.beads) {
          const x = s.l + b.u;
          const y = s.t - b.r * 0.35;
          ctx.fillStyle = "rgba(220,236,250,0.82)";
          ctx.strokeStyle = "rgba(60,100,135,0.85)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x, y, b.r * 1.35, b.r, 0, 0, 6.283);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.arc(x - b.r * 0.35, y - b.r * 0.35, Math.max(0.6, b.r * 0.28), 0, 6.283);
          ctx.fill();
        }
        // snow settled on the top edge
        for (const r of st.rest) {
          const a = 1 - r.age / r.life;
          ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`;
          ctx.strokeStyle = `rgba(140,165,190,${0.55 * a})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(s.l + r.u, s.t - r.r * 0.3, r.r * 1.4, r.r, 0, 0, 6.283);
          ctx.fill();
          ctx.stroke();
        }
      }

      // splash droplets thrown off the cards, and the little ring where a drop landed
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        p.vy += 520 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.age > p.max) {
          parts.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(200,222,242,${0.85 * (1 - p.age / p.max)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.age += dt;
        if (rp.age > 0.3) {
          ripples.splice(i, 1);
          continue;
        }
        const k = rp.age / 0.3;
        ctx.strokeStyle = `rgba(70,110,145,${0.5 * (1 - k)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(rp.x, rp.y, 2 + k * 9, 1 + k * 2.4, 0, 0, 6.283);
        ctx.stroke();
      }

      // ---- sun: a subtle warm reflection on each card's top-right corner (the sun sits at the top-right of the page) ----
      // The closer a card's top-right corner is to the sun, the stronger its reflection, so as the page scrolls the light
      // moves from card to card: cards passing near the top-right light up, cards further down stay calm.
      if (sunny) {
        const sunX = W * 0.9;
        const sunY = -H * 0.06;
        const reach = Math.max(500, H * 1.05);
        for (const s of surfs) {
          const cx = s.r - Math.min(40, s.w * 0.08);
          const cy = s.t + Math.min(30, s.h * 0.1);
          const k = 1 - Math.hypot(cx - sunX, cy - sunY) / reach;
          if (k <= 0) continue;
          const power = k * k; // 0..1, falls off quickly with distance from the sun
          ctx.save();
          rr(s.l, s.t, s.w, s.h, 16);
          ctx.clip();
          const hr = Math.max(70, Math.min(s.w, s.h) * 0.85);
          const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, hr);
          hg.addColorStop(0, `rgba(255,222,120,${0.2 * power})`);
          hg.addColorStop(1, "rgba(255,222,120,0)");
          ctx.fillStyle = hg;
          ctx.fillRect(s.l, s.t, s.w, s.h);
          ctx.restore();
          // thin light along the top edge and down the right edge, fading away from the corner
          const runX = Math.min(150, s.w * 0.5);
          const runY = Math.min(90, s.h * 0.6);
          const top = ctx.createLinearGradient(s.r - runX, 0, s.r - 10, 0);
          top.addColorStop(0, "rgba(255,240,180,0)");
          top.addColorStop(1, `rgba(255,240,180,${0.42 * power})`);
          ctx.strokeStyle = top;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(s.r - runX, s.t + 0.5);
          ctx.lineTo(s.r - 12, s.t + 0.5);
          ctx.stroke();
          const right = ctx.createLinearGradient(0, s.t + 12, 0, s.t + runY);
          right.addColorStop(0, `rgba(255,240,180,${0.36 * power})`);
          right.addColorStop(1, "rgba(255,240,180,0)");
          ctx.strokeStyle = right;
          ctx.beginPath();
          ctx.moveTo(s.r - 0.5, s.t + 12);
          ctx.lineTo(s.r - 0.5, s.t + runY);
          ctx.stroke();
        }
      }

      // ---- lightning: soft white flash over the whole page ------------------------------------------------------
      if (kind === "thunder") {
        let flash = 0;
        for (const t of flashAt) {
          const age = now - t;
          if (age >= 0 && age < 360) flash = Math.max(flash, 0.2 * (1 - age / 360));
        }
        if (flash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${flash})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      window.removeEventListener("weather-strike", onStrike);
    };
  }, [kind, sunny, wind]);

  return <canvas ref={ref} className="size-full" />;
}
