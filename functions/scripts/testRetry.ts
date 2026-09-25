// Offline test for the Gemini rate-limit retry logic in pipeline.ts (no network, no Gemini calls).
// Run: npm run build && node lib/scripts/testRetry.js
import { parseRetryDelayMs, retryWaitMs, runPipeline, DEFAULT_RETRY_MS, QuotaError } from "../agents/pipeline";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed++;
};

const REAL_429 =
  "advisory_agent: 429 You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 5, model: gemini-3.6-flash\nPlease retry in 8.429704012s.";

check("parses the real 429 message", parseRetryDelayMs(REAL_429) === 8430, String(parseRetryDelayMs(REAL_429)));
check("parses retryDelay JSON form", parseRetryDelayMs('{"retryDelay":"12s"}') === 12000);
check("no hint -> null", parseRetryDelayMs("429 something else") === null);
check("wait = hint + margin (>= hint)", retryWaitMs(REAL_429) === 9430, String(retryWaitMs(REAL_429)));
check("no hint -> safe default (>= 8s)", retryWaitMs("429 no hint") === DEFAULT_RETRY_MS && DEFAULT_RETRY_MS >= 8000);

const ok = { diagnosis: { disease: "x", severity: "low", confidence: 1, needsReview: false }, advisory: "a" } as never;

async function scenario(name: string, errors: (string | null)[]) {
  const waits: number[] = [];
  let calls = 0;
  const run = async () => {
    const e = errors[calls++];
    if (e) throw new Error(e);
    return ok;
  };
  try {
    await runPipeline("", "image/jpeg", 0, 0, "", run as never, async (ms) => void waits.push(ms));
    return { name, calls, waits, threw: null as unknown };
  } catch (e) {
    return { name, calls, waits, threw: e };
  }
}

(async () => {
  // The exact failure from 2026-09-25: 503, then a per-minute 429 on the last attempt. Now gets an extra attempt.
  let r = await scenario("503 then per-minute 429 then success", ["x: 503 overloaded", REAL_429, null]);
  check("recovers via the extra attempt", !r.threw && r.calls === 3, `calls=${r.calls}`);
  check("waited at least the API hint (8430 ms), not 5-6 s", r.waits.length === 1 && r.waits[0] >= 8430, JSON.stringify(r.waits));

  r = await scenario("429 with no hint then success", ["x: 429 slow down", null]);
  check("no-hint 429 waits the safe default", !r.threw && r.waits[0] === DEFAULT_RETRY_MS, JSON.stringify(r.waits));

  r = await scenario("daily quota is not retried", ["x: 429 PerDay exceeded"]);
  check("PerDay 429 -> QuotaError, no retry, no wait", r.threw instanceof QuotaError && r.calls === 1 && r.waits.length === 0);

  r = await scenario("persistent per-minute 429", [REAL_429, REAL_429, REAL_429, REAL_429]);
  check("gives up after one bonus attempt (3 calls) with QuotaError", r.threw instanceof QuotaError && r.calls === 3, `calls=${r.calls}`);

  r = await scenario("plain 503 twice", ["x: 503 a", "x: 503 b"]);
  check("non-429 errors unchanged: 2 attempts, no wait, original error", r.calls === 2 && r.waits.length === 0 && !(r.threw instanceof QuotaError));

  r = await scenario("long hint on last attempt", ["x: 429 x", "x: 429 Please retry in 90s."]);
  check("hint over 30 s does not earn an extra attempt", r.calls === 2 && r.threw instanceof QuotaError, `calls=${r.calls}`);

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
})();
