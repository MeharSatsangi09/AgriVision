"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";

// "Reduce motion": the visitor's own switch (profile menu) wins; until they touch it, the device's setting is followed.
// When on: smooth scroll and looping/decorative animation stop, weather effects go static, and motion components skip
// movement (see the [data-reduce-motion] rule in globals.css). The choice is kept in this browser only.
type Ctx = { reduce: boolean; setReduce: (v: boolean) => void };
const ReduceMotionContext = createContext<Ctx>({ reduce: false, setReduce: () => {} });
const KEY = "reduceMotion";

export function ReduceMotionProvider({ children }: { children: ReactNode }) {
  const [system, setSystem] = useState(false);
  const [chosen, setChosen] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystem(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "1") setChosen(true);
      else if (saved === "0") setChosen(false);
    } catch { }
    return () => mq.removeEventListener("change", sync);
  }, []);

  const reduce = chosen ?? system;

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduce ? "true" : "false";
  }, [reduce]);

  const setReduce = useCallback((v: boolean) => {
    setChosen(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { }
  }, []);

  const value = useMemo(() => ({ reduce, setReduce }), [reduce, setReduce]);
  return (
    <ReduceMotionContext.Provider value={value}>
      <MotionConfig reducedMotion={reduce ? "always" : "user"}>{children}</MotionConfig>
    </ReduceMotionContext.Provider>
  );
}

export const useReduceMotion = () => useContext(ReduceMotionContext);
