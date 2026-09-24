const TIMEOUT_MS = 8_000;
const LOOKAHEAD_STEPS = 8; // OpenWeatherMap's 5-day/3-hour forecast, 8 steps = next 24h

// OpenWeatherMap's free-tier 5-day/3-hour forecast (not the paid One Call 3.0 API) — current
// conditions plus a same-day rain outlook for the Advisory Agent's timing guidance (e.g. don't
// recommend spraying right before expected rain). Returns "" on any failure/timeout/missing key —
// the Advisory Agent's instruction handles an empty weather string by just not mentioning it,
// same never-blocks-the-report contract as the classifier and Earth Engine lookups.
export async function getWeatherSummary(lat: number, lng: number): Promise<string> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return "";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${key}&units=metric&cnt=${LOOKAHEAD_STEPS}`;
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`OpenWeatherMap ${res.status}`);
    const data: any = await res.json();
    const steps: any[] = data.list ?? [];
    if (!steps.length) return "";

    const now = steps[0];
    const nowDesc = now.weather?.[0]?.description ?? "unknown conditions";
    const nowTemp = Math.round(now.main?.temp ?? 0);
    const nowHumidity = Math.round(now.main?.humidity ?? 0);

    const rainSteps = steps.filter((s) => (s.rain?.["3h"] ?? 0) > 0 || (s.pop ?? 0) >= 0.4);
    const rainSoon = rainSteps.length > 0;
    const hoursUntilRain = rainSoon ? steps.indexOf(rainSteps[0]) * 3 : null;

    const rainPart = rainSoon
      ? hoursUntilRain === 0
        ? "Rain is likely within the next 3 hours."
        : `Rain is likely in about ${hoursUntilRain}-${hoursUntilRain! + 3} hours.`
      : "No significant rain expected in the next 24 hours.";

    return `Currently ${nowTemp}°C, ${nowDesc}, ${nowHumidity}% humidity. ${rainPart}`;
  } catch (err) {
    console.warn("weather lookup failed:", err);
    return "";
  } finally {
    clearTimeout(timer);
  }
}
