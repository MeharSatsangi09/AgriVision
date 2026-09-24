"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ArrowUpRight, Leaf, MoveDown } from "lucide-react";

const scenes = [
    { eyebrow: "AGRIVISION", title: "AgriVision", copy: "", action: "", href: "", image: "/healthy-field.jpg", position: "center 52%", tone: "from-black/5 via-black/10 to-black/55", textMotion: { initial: { opacity: 0, scale: 0.88, y: 18, filter: "blur(14px)" }, animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.9, ease: "easeOut" as const } } },
    { eyebrow: "START WITH WHAT YOU CAN SEE", title: "A closer look changes everything.", copy: "One real leaf. One clear signal. Begin with the crop in front of you.", action: "Open diagnosis", href: "/diagnose", image: "/reference-leaf.jpeg", position: "center 48%", tone: "from-black/5 via-black/25 to-[#152415]/75", textMotion: { initial: { opacity: 0, x: -48, filter: "blur(5px)" }, animate: { opacity: 1, x: 0, filter: "blur(0px)" }, transition: { duration: 0.62, ease: "easeOut" as const } } },
    { eyebrow: "READ THE FIELD", title: "Small changes become visible patterns.", copy: "See the diagnosis, understand the risk, and follow what is happening around your field.", action: "Explore the map", href: "/map", image: "/crop-field.jpg", position: "center 48%", tone: "from-[#415c33]/5 via-[#233c24]/35 to-[#152317]/80", textMotion: { initial: { opacity: 0, y: 52, filter: "blur(8px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.72, ease: "easeOut" as const } } },
    { eyebrow: "KEEP WATCH", title: "Protect the next harvest.", copy: "A practical view of crop health for the people who grow what matters.", action: "See active alerts", href: "/alerts", image: "/golden-field.jpg", position: "center 55%", tone: "from-[#927d54]/5 via-[#392e1d]/30 to-[#17150f]/80", textMotion: { initial: { opacity: 0, scale: 1.08, y: 8, filter: "blur(7px)" }, animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.8, ease: "easeOut" as const } } },
] as const;

export default function LivingFieldLanding() {
    const [scene, setScene] = useState(0);
    const [direction, setDirection] = useState<1 | -1>(1);
    const [busy, setBusy] = useState(false);
    const touchStart = useRef<number | null>(null);
    const reducedMotion = useReducedMotion();
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

    const current = scenes[scene];
    const titleWords = current.title.split(" ");
    const titleLetters = Array.from(current.title);
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

            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 md:p-10 lg:p-14">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm font-semibold tracking-[0.18em]">
                        <span className="grid size-9 place-items-center rounded-full border border-white/30 bg-black/10 backdrop-blur-sm"><Leaf className="size-4" /></span>
                        <span>{scene === 0 ? "" : "AGRIVISION"}</span>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div key={scene} initial={reducedMotion ? { opacity: 0 } : current.textMotion.initial} animate={reducedMotion ? { opacity: 1 } : current.textMotion.animate} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }} transition={reducedMotion ? { duration: 0 } : current.textMotion.transition} className={scene === 0 ? "self-center text-center" : "max-w-xl"}>
                        <motion.p initial={{ opacity: 0, y: 18, letterSpacing: "0.42em" }} animate={{ opacity: 1, y: 0, letterSpacing: "0.24em" }} transition={{ delay: reducedMotion ? 0 : 0.1, duration: reducedMotion ? 0 : 0.6 }} className="text-xs font-bold uppercase text-white/70">{current.eyebrow}</motion.p>
                        <h1 className={scene === 0 ? "mt-5 text-6xl font-semibold tracking-[-0.04em] md:text-9xl" : "mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.03em] md:text-7xl"}>
                            {scene === 0
                                ? titleLetters.map((letter, index) => (
                                    <motion.span
                                        key={`${scene}-${letter}-${index}`}
                                        className="inline-block"
                                        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: letterOffsets[index % letterOffsets.length], y: letterLift[index % letterLift.length], rotate: letterTilt[index % letterTilt.length], scale: 0.35, filter: "blur(12px)" }}
                                        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, filter: "blur(0px)" }}
                                        transition={{ delay: reducedMotion ? 0 : 0.16 + index * 0.075, duration: reducedMotion ? 0 : 0.85, ease: [0.16, 1, 0.3, 1] }}
                                    >
                                        {letter === " " ? "\u00a0" : letter}
                                    </motion.span>
                                ))
                                : titleWords.map((word, index) => (
                                    <motion.span key={`${scene}-${word}-${index}`} className="mr-[0.22em] inline-block" initial={{ opacity: 0, y: 42, rotateX: -65 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: reducedMotion ? 0 : 0.18 + index * 0.075, duration: reducedMotion ? 0 : 0.62, ease: [0.22, 1, 0.36, 1] }}>
                                        {word}
                                    </motion.span>
                                ))}
                        </h1>
                        {current.copy && <motion.p initial={{ opacity: 0, y: 24, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: reducedMotion ? 0 : 0.48, duration: reducedMotion ? 0 : 0.6 }} className="mt-5 max-w-md text-base leading-7 text-white/80 md:text-lg">{current.copy}</motion.p>}
                        {current.href && <motion.div initial={{ opacity: 0, y: 22, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: reducedMotion ? 0 : 0.62, type: "spring", stiffness: 230, damping: 20 }}><Link href={current.href} className="pointer-events-auto mt-7 inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1d3420] shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:bg-[#e6edda] hover:shadow-[0_16px_35px_rgba(0,0,0,0.28)]">{current.action} <ArrowUpRight className="size-4" /></Link></motion.div>}
                    </motion.div>
                </AnimatePresence>

                <div className="flex items-end justify-between gap-6">
                    <div className="flex items-end gap-4" aria-label="Landing screens">
                        <div className="flex flex-col gap-2">
                            {scenes.map((item, index) => <span key={item.title} className={`transition-all duration-500 ${index === scene ? "h-10 w-1 bg-white" : "h-2 w-1 bg-white/45"}`} />)}
                        </div>
                        <div className="hidden max-w-[12rem] text-xs uppercase tracking-[0.18em] text-white/65 sm:block">{scene === 0 ? "A clearer view begins here" : current.eyebrow}</div>
                    </div>
                    <button type="button" onClick={() => move(1)} disabled={scene === scenes.length - 1} className="pointer-events-auto inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:text-white disabled:opacity-0">Scroll to enter <MoveDown className="size-4 animate-bounce" /></button>
                </div>
            </div>
        </main>
    );
}
