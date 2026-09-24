"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform, type SpringOptions } from "motion/react";
import { cn } from "@/lib/utils";

// Motion Primitives-style Spotlight: a blurred gradient orb that follows the cursor inside its parent.
// The parent must be `relative overflow-hidden`; with a 1px padding around an inner card it reads as a glowing border.
export function Spotlight({
  className,
  size = 200,
  springOptions = { bounce: 0 },
  gradient = "radial-gradient(circle at center, #2f6b3a, #4ade80 45%, transparent 75%)",
}: {
  className?: string;
  size?: number;
  springOptions?: SpringOptions;
  gradient?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [parent, setParent] = useState<HTMLElement | null>(null);
  const x = useSpring(0, springOptions);
  const y = useSpring(0, springOptions);
  const left = useTransform(x, (v) => `${v - size / 2}px`);
  const top = useTransform(y, (v) => `${v - size / 2}px`);

  useEffect(() => {
    const p = ref.current?.parentElement;
    if (p) {
      p.style.position ||= "relative";
      p.style.overflow = "hidden";
      setParent(p);
    }
  }, []);

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      x.set(e.clientX - r.left);
      y.set(e.clientY - r.top);
    },
    [parent, x, y]
  );

  useEffect(() => {
    if (!parent) return;
    const enter = () => setHover(true);
    const leave = () => setHover(false);
    parent.addEventListener("mousemove", onMove);
    parent.addEventListener("mouseenter", enter);
    parent.addEventListener("mouseleave", leave);
    return () => {
      parent.removeEventListener("mousemove", onMove);
      parent.removeEventListener("mouseenter", enter);
      parent.removeEventListener("mouseleave", leave);
    };
  }, [parent, onMove]);

  return (
    <motion.div
      ref={ref}
      className={cn(
        "pointer-events-none absolute rounded-full opacity-0 transition-opacity duration-200",
        hover && "opacity-100",
        className
      )}
      style={{ width: size, height: size, left, top, background: gradient }}
    />
  );
}
