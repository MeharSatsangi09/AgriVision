import { SequentialAgent, InMemoryRunner } from "@google/adk";
import { diagnosisAgent, parseDiagnosis, type Diagnosis } from "./diagnosisAgent";
import { advisoryAgent } from "./advisoryAgent";

// Diagnosis -> Advisory, output of the first flows to the second via session state.
export const pipeline = new SequentialAgent({
  name: "crop_pipeline",
  subAgents: [diagnosisAgent, advisoryAgent],
});

const APP = "crop-advisor";

type Result = { diagnosis: Diagnosis; advisory: string };

const ATTEMPT_TIMEOUT_MS = 55_000;
const ATTEMPTS = 2;

export class QuotaError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gemini calls occasionally hang or 5xx; cancel each attempt after a timeout and retry once.
// A daily-quota 429 is not retried (pointless); a per-minute 429 waits a few seconds first.
export async function runPipeline(imageBase64: string, mimeType: string, lat: number, lng: number): Promise<Result> {
  let lastErr: unknown;
  for (let i = 1; i <= ATTEMPTS; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      return await runOnce(imageBase64, mimeType, lat, lng, ctl.signal);
    } catch (e) {
      lastErr = ctl.signal.aborted ? new Error(`pipeline attempt ${i} timed out`) : e;
      console.error(`runPipeline attempt ${i} failed:`, lastErr);
      const msg = String((lastErr as Error)?.message ?? "");
      if (msg.includes("429")) {
        if (msg.includes("PerDay")) throw new QuotaError(msg);
        if (i < ATTEMPTS) await sleep(6000);
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
  return {
    diagnosis: parseDiagnosis(state["diagnosis"]),
    advisory: String(state["advisory"] ?? "").trim(),
  };
}
