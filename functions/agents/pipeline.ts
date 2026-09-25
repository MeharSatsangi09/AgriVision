import { SequentialAgent, InMemoryRunner } from "@google/adk";
import { diagnosisAgent, parseDiagnosis, type Diagnosis } from "./diagnosisAgent";
import { advisoryAgent, parseAdvisory } from "./advisoryAgent";
import { agreesWith, classifyImage, storageSource, type ClassifierResult } from "../tools/classifierTool";
import { getVegetationIndex, type SatelliteData } from "../tools/earthEngineTool";
import { getWeatherSummary } from "../tools/weatherTool";
import { getSoilHealth, type SoilHealth } from "../tools/soilGridsTool";

// Diagnosis -> Advisory, output of the first flows to the second via session state.
export const pipeline = new SequentialAgent({
  name: "crop_pipeline",
  subAgents: [diagnosisAgent, advisoryAgent],
});

const APP = "crop-advisor";

type Result = { diagnosis: Diagnosis; advisory: string; regenerativeTip?: string };

const ATTEMPT_TIMEOUT_MS = 55_000;
const ATTEMPTS = 2;

export class QuotaError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A per-minute 429 says how long to wait ("Please retry in 8.4s" / retryDelay "8s"). Wait at least that
// long (plus a small margin); with no parseable hint, fall back to a safe default instead of guessing low.
export const DEFAULT_RETRY_MS = 9_000;
const RETRY_MARGIN_MS = 1_000;
const MAX_HINT_MS = 30_000; // a longer hint isn't worth blocking the upload on
export function parseRetryDelayMs(message: string): number | null {
  const m = /retry in ([\d.]+)\s*s/i.exec(message) ?? /"?retryDelay"?\s*[:=]\s*"?([\d.]+)s/i.exec(message);
  if (!m) return null;
  const secs = parseFloat(m[1]);
  return Number.isFinite(secs) && secs >= 0 ? Math.round(secs * 1000) : null;
}
export const retryWaitMs = (message: string) => {
  const hint = parseRetryDelayMs(message);
  return hint === null ? DEFAULT_RETRY_MS : Math.max(hint + RETRY_MARGIN_MS, RETRY_MARGIN_MS);
};

// Gemini calls occasionally hang or 5xx; cancel each attempt after a timeout and retry once.
// A daily-quota 429 is not retried (pointless). A per-minute 429 waits the API's own retry-after hint
// (default 9s) before retrying; if it strikes on the last attempt and the hint is short, one extra
// attempt is granted so the wait is actually used instead of failing the upload.
export async function runPipeline(
  imageBase64: string,
  mimeType: string,
  lat: number,
  lng: number,
  weather = "",
  run: typeof runOnce = runOnce,
  wait: (ms: number) => Promise<unknown> = sleep
): Promise<Result> {
  let lastErr: unknown;
  let maxAttempts = ATTEMPTS;
  let bonusUsed = false;
  for (let i = 1; i <= maxAttempts; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      return await run(imageBase64, mimeType, lat, lng, weather, ctl.signal);
    } catch (e) {
      lastErr = ctl.signal.aborted ? new Error(`pipeline attempt ${i} timed out`) : e;
      console.error(`runPipeline attempt ${i} failed:`, lastErr);
      const msg = String((lastErr as Error)?.message ?? "");
      if (msg.includes("429")) {
        if (msg.includes("PerDay")) throw new QuotaError(msg);
        const hint = parseRetryDelayMs(msg);
        if (i === maxAttempts && !bonusUsed && (hint === null || hint <= MAX_HINT_MS)) {
          bonusUsed = true;
          maxAttempts += 1;
        }
        if (i < maxAttempts) {
          const ms = retryWaitMs(msg);
          console.warn(`runPipeline: rate limited, waiting ${ms} ms before retry (hint ${hint ?? "none"} ms)`);
          await wait(ms);
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }
  if (String((lastErr as Error)?.message ?? "").includes("429")) throw new QuotaError(String((lastErr as Error).message));
  throw lastErr;
}

async function runOnce(
  imageBase64: string,
  mimeType: string,
  lat: number,
  lng: number,
  weather: string,
  abortSignal: AbortSignal
): Promise<Result> {
  const runner = new InMemoryRunner({ agent: pipeline, appName: APP });
  const sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = "farmer";
  await runner.sessionService.createSession({
    appName: APP,
    userId,
    sessionId,
    state: {
      location: `lat ${lat}, lng ${lng}`,
      today: new Date().toISOString().slice(0, 10),
      weather,
    },
  });

  for await (const ev of runner.runAsync({
    userId,
    sessionId,
    abortSignal,
    newMessage: {
      role: "user",
      parts: [{ text: "Diagnose this crop photo." }, { inlineData: { mimeType, data: imageBase64 } }],
    },
  })) {
    if (ev.errorCode) throw new Error(`${ev.author}: ${ev.errorCode} ${ev.errorMessage ?? ""}`);
  }

  const session = await runner.sessionService.getSession({ appName: APP, userId, sessionId });
  const state = session?.state ?? {};
  const { advisory, regenerativeTip } = parseAdvisory(state["advisory"]);
  return {
    diagnosis: parseDiagnosis(state["diagnosis"]),
    advisory,
    ...(regenerativeTip ? { regenerativeTip } : {}),
  };
}

const CLASSIFIER_TIMEOUT_MS = 30_000;
const EARTH_ENGINE_TIMEOUT_MS = 20_000;
const WEATHER_TIMEOUT_MS = 8_000; // matches weatherTool.ts's own internal timeout
const SOILGRIDS_TIMEOUT_MS = 20_000; // matches soilGridsTool.ts's own internal timeout; ISRIC's latency is variable

// Runs our own trained classifier NEXT TO the Gemini pipeline (side by side, never feeding into it).
// The classifier can never fail or delay the main result: any error or timeout just means no second opinion.
// It is awaited even when Gemini fails, so its outcome is always logged (and the model load is verifiable).
// The Earth Engine vegetation-index lookup follows the exact same never-blocks contract. The weather
// lookup is the one exception that IS awaited before the Gemini pipeline starts (capped at 8s) — the
// Advisory Agent needs it in its initial session state, which must be set before diagnosisAgent runs.
export async function runAnalysis(
  image: Buffer,
  mimeType: string,
  lat: number,
  lng: number,
  bucketName?: string
): Promise<
  Result & { classifier: ClassifierResult | null; satelliteData: SatelliteData | null; soilHealth: SoilHealth | null }
> {
  const classifier: Promise<ClassifierResult | null> = Promise.race([
    classifyImage(image, storageSource(bucketName)),
    sleep(CLASSIFIER_TIMEOUT_MS).then(() => null),
  ]).catch((err) => {
    console.warn("classifier failed:", err);
    return null;
  });
  const satellite: Promise<SatelliteData | null> = Promise.race([
    getVegetationIndex(lat, lng),
    sleep(EARTH_ENGINE_TIMEOUT_MS).then(() => null),
  ]).catch((err) => {
    console.warn("earth engine failed:", err);
    return null;
  });
  const soil: Promise<SoilHealth | null> = Promise.race([
    getSoilHealth(lat, lng),
    sleep(SOILGRIDS_TIMEOUT_MS).then(() => null),
  ]).catch((err) => {
    console.warn("soilgrids failed:", err);
    return null;
  });
  const weather = await Promise.race([getWeatherSummary(lat, lng), sleep(WEATHER_TIMEOUT_MS).then(() => "")]).catch(
    (err) => {
      console.warn("weather lookup failed:", err);
      return "";
    }
  );
  console.log(weather ? `weather: ${weather}` : "weather: no result");

  const [main, cls, sat, soi] = await Promise.allSettled([
    runPipeline(image.toString("base64"), mimeType, lat, lng, weather),
    classifier,
    satellite,
    soil,
  ]);
  const c = cls.status === "fulfilled" ? cls.value : null;
  const s = sat.status === "fulfilled" ? sat.value : null;
  const sh = soi.status === "fulfilled" ? soi.value : null;
  if (main.status === "rejected") {
    console.log(c ? `classifier: ${c.label} ${c.confidence} (${c.ms} ms)` : "classifier: no result");
    throw main.reason;
  }
  if (c) c.agreesWithGemini = agreesWith(c, main.value.diagnosis.disease);
  console.log(
    c
      ? `classifier: ${c.label} ${c.confidence} lowConfidence=${c.lowConfidence} agreesWithGemini=${c.agreesWithGemini} (${c.ms} ms)`
      : "classifier: no result"
  );
  console.log(s ? `earth engine: ndvi=${s.ndvi} date=${s.date}` : "earth engine: no result");
  console.log(sh ? `soilgrids: organicCarbon=${sh.organicCarbon} ph=${sh.ph}` : "soilgrids: no result");
  return { ...main.value, classifier: c, satelliteData: s, soilHealth: sh };
}
