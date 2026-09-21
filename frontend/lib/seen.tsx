"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { groupOutbreaks, useData } from "@/lib/data";

// Per-viewer "seen" state for outbreak alerts, kept in this browser only (localStorage). Outbreaks themselves are
// shared facts cleared solely by the Trend Agent's expiry; this only decides whether the header badge and home banner
// shout. A grown cluster gets a new key (its alertReason contains the count), so it alerts again.
const STORAGE_KEY = "seenOutbreaks";

interface Seen {
  active: string[]; // keys of all currently active outbreaks
  seen: Set<string>;
  unseenCount: number;
  loaded: boolean; // saved state has been read from localStorage
  markSeen: (keys: string[]) => void;
}

const Ctx = createContext<Seen>({ active: [], seen: new Set(), unseenCount: 0, loaded: false, markSeen: () => {} });

export function SeenProvider({ children }: { children: ReactNode }) {
  const { reports, ready } = useData();
  const activeKey = groupOutbreaks(reports).map((o) => o.key).join("\n");
  const active = useMemo(() => (activeKey ? activeKey.split("\n") : []), [activeKey]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Storage can be unavailable (private window, blocked site data) — everything still works without it.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSeen(new Set(JSON.parse(raw) as string[]));
    } catch {}
    setLoaded(true);
  }, []);

  // Forget outbreaks that no longer exist, so a recurrence alerts again. Only once real data has arrived.
  useEffect(() => {
    if (!ready || !loaded) return;
    setSeen((prev) => {
      const next = new Set([...prev].filter((k) => active.includes(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [active, ready, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
    } catch {}
  }, [seen, loaded]);

  const markSeen = useCallback((keys: string[]) => {
    setSeen((prev) => (keys.every((k) => prev.has(k)) ? prev : new Set([...prev, ...keys])));
  }, []);

  const value = useMemo(
    () => ({ active, seen, unseenCount: active.filter((k) => !seen.has(k)).length, loaded, markSeen }),
    [active, seen, loaded, markSeen]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSeen = () => useContext(Ctx);
