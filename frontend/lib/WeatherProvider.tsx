"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_PLACE, fetchWeather, type Condition, type Weather } from "@/lib/weather";

// Weather for the visitor's location (browser geolocation; New Delhi if they don't share it), refreshed every 15 minutes.
// `condition` is what the whole site looks like: the real weather, unless a preview was picked in the weather card.
interface WeatherState {
  weather: Weather | null;
  status: "loading" | "ready" | "error";
  usingDefault: boolean; // true when the location was not shared and New Delhi is shown
  condition: Condition | null;
  preview: Condition | null;
  setPreview: (c: Condition | null) => void;
  reload: () => void;
}

const Ctx = createContext<WeatherState>({
  weather: null, status: "loading", usingDefault: false, condition: null, preview: null, setPreview: () => {}, reload: () => {},
});

const REFRESH_MS = 15 * 60_000; // Open-Meteo updates its "current" values about every 15 minutes
const STALE_MS = 5 * 60_000; // coming back to the tab after this long refreshes right away

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<{ lat: number; lng: number; isDefault: boolean } | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [status, setStatus] = useState<WeatherState["status"]>("loading");
  const [preview, setPreview] = useState<Condition | null>(null);
  const [tick, setTick] = useState(0);
  const asked = useRef(false);

  // Ask the browser for the location once; fall back to New Delhi on refusal, timeout or no support.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const fallback = () => setPlace({ ...DEFAULT_PLACE, isDefault: true });
    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(
      (p) => setPlace({ lat: p.coords.latitude, lng: p.coords.longitude, isDefault: false }),
      fallback,
      { timeout: 8000, maximumAge: 30 * 60_000 }
    );
  }, []);

  useEffect(() => {
    if (!place) return;
    const ctl = new AbortController();
    fetchWeather(place.lat, place.lng, ctl.signal)
      .then((w) => {
        setWeather(w);
        setStatus("ready");
      })
      .catch((e) => e?.name !== "AbortError" && setStatus((s) => (s === "ready" ? s : "error")));
    return () => ctl.abort();
  }, [place, tick]);

  // The site follows the real weather on its own: refresh every 15 minutes while the tab is open, and immediately when the
  // visitor returns to a tab that has been in the background (timers are throttled there). Picking a preview in the weather
  // card is the only thing that overrides it, until "Live weather" is chosen again.
  const fetchedAt = useRef(0);
  useEffect(() => {
    fetchedAt.current = weather?.fetchedAt ?? 0;
  }, [weather]);
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && setTick((t) => t + 1), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAt.current > STALE_MS) setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const reload = useCallback(() => {
    setStatus((s) => (s === "ready" ? s : "loading"));
    setTick((t) => t + 1);
  }, []);

  const value = useMemo<WeatherState>(
    () => ({
      weather,
      status,
      usingDefault: !!place?.isDefault,
      condition: preview ?? weather?.current.condition ?? null,
      preview,
      setPreview,
      reload,
    }),
    [weather, status, place, preview, reload]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useWeather = () => useContext(Ctx);
