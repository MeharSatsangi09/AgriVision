"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import { useReduceMotion } from "@/lib/reduceMotion";

export default function SmoothScroll() {
  const { reduce } = useReduceMotion();
  useEffect(() => {
    if (reduce) return; // native scrolling when motion is reduced
    const lenis = new Lenis();
    let frame: number;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reduce]);

  return null;
}
