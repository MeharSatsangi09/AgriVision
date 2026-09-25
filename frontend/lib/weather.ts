// Weather from Open-Meteo (free, no API key, called straight from the browser). Only the location rounded to about 1 km
// is sent, the same precision the app already uses for reports.
export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "showers" | "thunder" | "snow";

export interface Condition {
  kind: WeatherKind;
  isDay: boolean;
}

export interface Weather {
  current: { temp: number; feels: number; humidity: number; wind: number; precip: number; condition: Condition };
  hours: { time: string; temp: number; rainChance: number; condition: Condition }[]; // rest of today, hour by hour
  days: { date: string; min: number; max: number; rainChance: number; kind: WeatherKind }[]; // today + next 6 days
  windSpeed: number;
  fetchedAt: number;
}

// WMO weather codes (what Open-Meteo returns) -> the handful of looks we render.
export function kindFromCode(code: number): WeatherKind {
  if (code === 0 || code === 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || code === 80) return "rain";
  if (code === 81 || code === 82) return "showers";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  return "cloudy";
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

// New Delhi: shown when the visitor does not share a location.
export const DEFAULT_PLACE = { lat: 28.61, lng: 77.21 };

export async function fetchWeather(lat: number, lng: number, signal?: AbortSignal): Promise<Weather> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day" +
    "&hourly=temperature_2m,precipitation_probability,weather_code,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=auto&forecast_days=7";
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const j = await res.json();
  const c = j.current;
  const nowIso: string = c.time; // "2026-09-25T14:15" in the place's own time
  const hours = (j.hourly.time as string[])
    .map((time, i) => ({
      time,
      temp: num(j.hourly.temperature_2m[i]),
      rainChance: num(j.hourly.precipitation_probability[i]),
      condition: { kind: kindFromCode(num(j.hourly.weather_code[i])), isDay: num(j.hourly.is_day[i], 1) === 1 },
    }))
    // from the current hour to the end of today
    .filter((h) => h.time.slice(0, 10) === nowIso.slice(0, 10) && h.time.slice(0, 13) >= nowIso.slice(0, 13));
  const days = (j.daily.time as string[]).map((date, i) => ({
    date,
    min: num(j.daily.temperature_2m_min[i]),
    max: num(j.daily.temperature_2m_max[i]),
    rainChance: num(j.daily.precipitation_probability_max[i]),
    kind: kindFromCode(num(j.daily.weather_code[i])),
  }));
  return {
    current: {
      temp: num(c.temperature_2m),
      feels: num(c.apparent_temperature),
      humidity: num(c.relative_humidity_2m),
      wind: num(c.wind_speed_10m),
      precip: num(c.precipitation),
      condition: { kind: kindFromCode(num(c.weather_code)), isDay: num(c.is_day, 1) === 1 },
    },
    hours,
    days,
    windSpeed: num(c.wind_speed_10m),
    fetchedAt: Date.now(),
  };
}

export const LOCALES: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", mr: "mr-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN", gu: "gu-IN", kn: "kn-IN", pa: "pa-IN",
};
