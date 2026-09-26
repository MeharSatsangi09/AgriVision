"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useReduceMotion } from "@/lib/reduceMotion";
import { ArrowUpRight, Leaf, MoveDown } from "lucide-react";

const scenes = [
    { eyebrow: "AGRIVISION", title: "AgriVision", copy: "", action: "", href: "", image: "/healthy-field.jpg", position: "center 52%", tone: "from-black/5 via-black/10 to-black/55", textMotion: { initial: { opacity: 0, scale: 0.88, y: 18, filter: "blur(14px)" }, animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.9, ease: "easeOut" as const } } },
    { eyebrow: "START WITH WHAT YOU CAN SEE", title: "A closer look changes everything.", copy: "One real leaf. One clear signal. Begin with the crop in front of you.", action: "Open diagnosis", href: "/diagnose", image: "/reference-leaf.jpeg", position: "center 48%", tone: "from-black/5 via-black/25 to-[#152415]/75", textMotion: { initial: { opacity: 0, x: -48, filter: "blur(5px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, transition: { duration: 0.62, ease: "easeOut" as const } } },
    { eyebrow: "READ THE FIELD", title: "Small changes become visible patterns.", copy: "See the diagnosis, understand the risk, and follow what is happening around your field.", action: "Explore the map", href: "/map", image: "/crop-field.jpg", position: "center 48%", tone: "from-[#415c33]/5 via-[#233c24]/35 to-[#152317]/80", textMotion: { initial: { opacity: 0, y: 52, filter: "blur(8px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.72, ease: "easeOut" as const } } },
    { eyebrow: "KEEP WATCH", title: "Protect the next harvest.", copy: "A practical view of crop health for the people who grow what matters.", action: "See active alerts", href: "/alerts", image: "/golden-field.jpg", position: "center 55%", tone: "from-[#927d54]/5 via-[#392e1d]/30 to-[#17150f]/80", textMotion: { initial: { opacity: 0, scale: 1.08, y: 8, filter: "blur(7px)" }, animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.8, ease: "easeOut" as const } } },
] as const;

// Per-scene colours sampled from each background photo: wordmark gradient + CTA button gradient.
const palettes = [
    { word: "linear-gradient(90deg, #7fd6e8 0%, #fbe7c0 42%, #ffc46b 72%, #ff9e4a 100%)", button: "linear-gradient(120deg, #fbe7c0, #ffc46b 55%, #ff9e4a)", glow: "rgba(255,170,80,0.55)", tint: "linear-gradient(120deg, rgba(251,231,192,0.28), rgba(255,158,74,0.26))" },
    { word: "linear-gradient(90deg, #f3f9b0 0%, #b5dd6b 50%, #5fb95f 100%)", button: "linear-gradient(120deg, #f3f9b0, #b5dd6b 55%, #5fb95f)", glow: "rgba(150,210,90,0.55)", tint: "linear-gradient(120deg, rgba(243,249,176,0.28), rgba(95,185,95,0.26))" },
    { word: "linear-gradient(90deg, #ffe08a 0%, #ff9d5c 50%, #a8d86a 100%)", button: "linear-gradient(120deg, #ffe08a, #ff9d5c 55%, #a8d86a)", glow: "rgba(255,150,90,0.55)", tint: "linear-gradient(120deg, rgba(255,224,138,0.28), rgba(168,216,106,0.26))" },
    { word: "linear-gradient(90deg, #fff3c0 0%, #f7c948 50%, #d9922b 100%)", button: "linear-gradient(120deg, #fff3c0, #f7c948 55%, #d9922b)", glow: "rgba(247,201,72,0.55)", tint: "linear-gradient(120deg, rgba(255,243,192,0.28), rgba(217,146,43,0.28))" },
] as const;

export default function LivingFieldLanding() {
    const [scene, setScene] = useState(0);
    const [direction, setDirection] = useState<1 | -1>(1);
    const [busy, setBusy] = useState(false);
    const touchStart = useRef<number | null>(null);
    const wordRef = useRef<HTMLDivElement>(null);
    const slotRef = useRef<HTMLSpanElement>(null);
    const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const settled = useRef(false);
    const [pos, setPos] = useState<{ x: number; y: number; scale: number } | null>(null);
    const [letterX, setLetterX] = useState<{ lefts: number[]; width: number } | null>(null);
    const { reduce: reducedMotion } = useReduceMotion();
    const pointerX = useSpring(useMotionValue(50), { stiffness: 70, damping: 22 });
    const pointerY = useSpring(useMotionValue(50), { stiffness: 70, damping: 22 });

    function move(direction: 1 | -1) {
        if (busy) return;
        const next = Math.max(0, Math.min(scenes.length - 1, scene + direction));
        if (next === scene) return;
        setBusy(true);
        setDirection(direction);
        setScene(next);
        window.setTimeout(() => setBusy(false), reducedMotion ? 0 : 720);
    }

    useEffect(() => {
        function onWheel(event: WheelEvent) {
            if (Math.abs(event.deltaY) < 12) return;
            event.preventDefault();
            move(event.deltaY > 0 ? 1 : -1);
        }
        function onKey(event: KeyboardEvent) {
            if (["ArrowDown", "PageDown", " "].includes(event.key)) { event.preventDefault(); move(1); }
            if (["ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); move(-1); }
        }
        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKey);
        };
    });

    // The one persistent wordmark: centred and huge on scene 0, then it glides up into the header slot.
    useLayoutEffect(() => {
        function place() {
            const el = wordRef.current;
            if (!el) return;
            const w = el.offsetWidth, h = el.offsetHeight;
            if (scene === 0) {
                setPos({ x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2, scale: 1 });
            } else {
                const slot = slotRef.current?.getBoundingClientRect();
                if (!slot) return;
                const scale = 22 / parseFloat(getComputedStyle(el).fontSize);
                setPos({ x: slot.left, y: slot.top + (slot.height - h * scale) / 2, scale });
            }
            setLetterX((prev) => prev ?? { lefts: letterRefs.current.map((l) => l?.offsetLeft ?? 0), width: w });
        }
        place();
        window.addEventListener("resize", place);
        return () => window.removeEventListener("resize", place);
    }, [scene]);

    useEffect(() => { if (pos) settled.current = true; }, [pos]);

    const current = scenes[scene];
    const palette = palettes[scene];
    const titleWords = current.title.split(" ");
    const titleLetters0 = Array.from("AgriVision");
    const letterOffsets = [-180, 130, -110, 190, -155, 105, -135, 165, -95];
    const letterLift = [80, -70, 120, -95, 65, -115, 92, -62, 105];
    const letterTilt = [-32, 26, -22, 34, -28, 20, -30, 24, -18];

    return (
        <main
            className="fixed inset-0 z-50 overflow-hidden bg-[#172318] text-white"
            onPointerMove={(event) => {
                if (reducedMotion) return;
                pointerX.set((event.clientX / window.innerWidth) * 100);
                pointerY.set((event.clientY / window.innerHeight) * 100);
            }}
            onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY ?? null; }}
            onTouchEnd={(event) => {
                if (touchStart.current === null) return;
                const distance = touchStart.current - (event.changedTouches[0]?.clientY ?? touchStart.current);
                touchStart.current = null;
                if (Math.abs(distance) > 42) move(distance > 0 ? 1 : -1);
            }}
        >
            <AnimatePresence mode="sync" custom={direction}>
                <motion.section
                    key={scene}
                    custom={direction}
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: direction * 90, scale: 1.08 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -90, scale: 0.96 }}
                    transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                >
                    <motion.img
                        src={current.image}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        style={{ objectPosition: current.position }}
                        initial={{ scale: reducedMotion ? 1 : 1.14, filter: "saturate(0.82) contrast(0.92)" }}
                        animate={scene === 0 && !reducedMotion
                            ? { scale: [1.08, 1.14, 1.09], x: ["-1.5%", "1.5%", "-1.5%"], y: ["0%", "-1.8%", "0%"], filter: ["saturate(1.02) contrast(0.98)", "saturate(1.12) contrast(1.03)", "saturate(1.04) contrast(1)"] }
                            : { scale: 1, x: direction * -1.5, y: scene === 0 ? 0 : -1, filter: "saturate(1.08) contrast(1)" }}
                        transition={scene === 0 && !reducedMotion
                            ? { duration: 18, repeat: Infinity, ease: "easeInOut" }
                            : { duration: reducedMotion ? 0 : 1.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                    {scene === 0 && !reducedMotion && (
                        <motion.div
                            aria-hidden
                            className="pointer-events-none absolute inset-[-7%] bg-cover bg-center opacity-20 mix-blend-soft-light"
                            style={{ backgroundImage: `url(${current.image})`, backgroundPosition: current.position }}
                            animate={{ x: ["-2.5%", "2.5%", "-2.5%"], y: ["1%", "-1.5%", "1%"], scale: [1.08, 1.13, 1.08], filter: ["blur(0px) saturate(1)", "blur(1px) saturate(1.2)", "blur(0px) saturate(1)"] }}
                            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
                        />
                    )}
                    <motion.div
                        className={`absolute inset-0 bg-gradient-to-b ${current.tone}`}
                        initial={{ opacity: 0.35, x: "-8%" }}
                        animate={{ opacity: 1, x: "0%" }}
                        transition={{ duration: reducedMotion ? 0 : 1.1, ease: "easeOut" }}
                    />
                    <motion.div
                        aria-hidden
                        className="pointer-events-none absolute size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(225,247,181,0.24),transparent_40%)] blur-2xl"
                        style={{ left: pointerX, top: pointerY }}
                        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {scene === 0 && !reducedMotion && (
                        <motion.div
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 -left-1/2 w-[75%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-[#fff3c4]/[0.14] to-transparent mix-blend-screen"
                            animate={{ x: ["-15%", "170%"], opacity: [0, 0.8, 0] }}
                            transition={{ duration: 12, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                        />
                    )}
                    <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent"
                        animate={{ left: ["-45%", "120%"] }}
                        transition={{ duration: reducedMotion ? 0 : 1.8, ease: "easeInOut" }}
                    />
                    <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-screen"
                        style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,.25) 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.18) 0 1px, transparent 1px)", backgroundSize: "90px 90px, 130px 130px" }}
                        animate={{ backgroundPosition: ["0 0", "90px 45px"] }}
                        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="absolute inset-0 bg-[#1c3521]/10 mix-blend-multiply" />
                </motion.section>
            </AnimatePresence>

            <motion.div
                ref={wordRef}
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-10 origin-top-left whitespace-nowrap pb-[0.12em] text-7xl font-semibold leading-[1.2] tracking-[-0.04em] drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] md:text-[11rem]"
                style={{ opacity: pos ? 1 : 0 }}
                initial={false}
                animate={{ x: pos?.x ?? 0, y: pos?.y ?? 0, scale: pos?.scale ?? 1 }}
                transition={settled.current ? { duration: reducedMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
            >
                {titleLetters0.map((letter, index) => (
                    <motion.span
                        key={index}
                        ref={(el) => { letterRefs.current[index] = el; }}
                        className="inline-block text-transparent [-webkit-background-clip:text] [background-clip:text]"
                        style={{
                            backgroundImage: palette.word,
                            backgroundSize: `${letterX?.width ?? 1000}px 100%`,
                            backgroundPosition: `${-(letterX?.lefts[index] ?? 0)}px 0`,
                        }}
                        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: letterOffsets[index % letterOffsets.length], y: letterLift[index % letterLift.length], rotate: letterTilt[index % letterTilt.length], scale: 0.35, filter: "blur(12px)" }}
                        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, filter: "blur(0px)" }}
                        transition={{ delay: reducedMotion ? 0 : 0.16 + index * 0.075, duration: reducedMotion ? 0 : 0.85, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {letter}
                    </motion.span>
                ))}
            </motion.div>

            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between [text-shadow:0_2px_14px_rgba(0,0,0,0.6),0_1px_3px_rgba(0,0,0,0.5)] p-6 md:p-10 lg:p-14">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm font-semibold tracking-[0.18em]">
                        <span className="grid size-9 place-items-center rounded-full border border-white/30 bg-black/10 backdrop-blur-sm"><Leaf className="size-4" /></span>
                        <span ref={slotRef} className="inline-block h-6 w-28" aria-hidden />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div key={scene} initial={reducedMotion ? { opacity: 0 } : current.textMotion.initial} animate={reducedMotion ? { opacity: 1 } : current.textMotion.animate} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }} transition={reducedMotion ? { duration: 0 } : current.textMotion.transition} className={scene === 0 ? "self-center text-center" : "max-w-xl"}>
                        {scene !== 0 && <motion.p initial={{ opacity: 0, y: 18, letterSpacing: "0.42em" }} animate={{ opacity: 1, y: 0, letterSpacing: "0.24em" }} transition={{ delay: reducedMotion ? 0 : 0.1, duration: reducedMotion ? 0 : 0.6 }} className="text-xs font-bold uppercase text-white/70">{current.eyebrow}</motion.p>}
                        {scene !== 0 && (
                            <h1 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.03em] md:text-7xl">
                                {titleWords.map((word, index) => (
                                    <motion.span key={`${scene}-${word}-${index}`} className="mr-[0.22em] inline-block" initial={{ opacity: 0, y: 42, rotateX: -65 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: reducedMotion ? 0 : 0.18 + index * 0.075, duration: reducedMotion ? 0 : 0.62, ease: [0.22, 1, 0.36, 1] }}>
                                        {word}
                                    </motion.span>
                                ))}
                            </h1>
                        )}
                        {current.copy && <motion.p initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: reducedMotion ? 0 : 0.48, duration: reducedMotion ? 0 : 0.6 }} className="mt-5 max-w-md text-base leading-7 text-white/80 md:text-lg">{current.copy}</motion.p>}
                        {current.href && (
                            <motion.div initial={{ opacity: 0, y: 22, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: reducedMotion ? 0 : 0.62, type: "spring", stiffness: 230, damping: 20 }} className="mt-7 inline-block">
                                <motion.div whileHover={{ scale: 1.07, y: -3 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} className="inline-block rounded-full" style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.22)" }}>
                                    <Link
                                        href={current.href}
                                        className="group pointer-events-auto relative inline-flex [text-shadow:none] items-center gap-3 overflow-hidden rounded-full px-5 py-3 text-sm font-semibold text-[#1d3420] transition-[background-position,box-shadow] duration-500 [background-size:200%_100%] hover:[background-position:100%_0] hover:shadow-[0_0_28px_6px_var(--glow)]"
                                        style={{ backgroundImage: palette.button, "--glow": palette.glow } as React.CSSProperties}
                                    >
                                        {current.action} <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                    </Link>
                                </motion.div>
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="flex items-end justify-between gap-6">
                    <div className="flex items-end gap-4" aria-label="Landing screens">
                        <div className="flex flex-col gap-2">
                            {scenes.map((item, index) => <span key={item.title} className={`transition-all duration-500 ${index === scene ? "h-10 w-1 bg-white" : "h-2 w-1 bg-white/45"}`} />)}
                        </div>
                        <div className="hidden max-w-[12rem] text-xs uppercase tracking-[0.18em] text-white/65 sm:block">{scene === 0 ? "A clearer view begins here" : current.eyebrow}</div>
                    </div>
                    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} className="pointer-events-auto">
                        {scene === scenes.length - 1 ? (
                            <Link href="/diagnose" className="group inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md transition-all duration-300 hover:brightness-125 hover:shadow-[0_0_24px_4px_var(--glow)]" style={{ backgroundImage: palette.tint, "--glow": palette.glow } as React.CSSProperties}>
                                Enter AgriVision <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </Link>
                        ) : (
                            <button type="button" onClick={() => move(1)} className="group inline-flex items-center gap-3 rounded-full border border-white/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md transition-all duration-300 hover:brightness-125 hover:shadow-[0_0_24px_4px_var(--glow)]" style={{ backgroundImage: palette.tint, "--glow": palette.glow } as React.CSSProperties}>
                                Scroll to enter <MoveDown className="size-4 animate-bounce" />
                            </button>
                        )}
                    </motion.div>
                </div>
            </div>
        </main>
    );
}
