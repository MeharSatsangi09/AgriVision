import { askFollowUp, type FollowUpContext } from "../agents/followUpAgent";

const FALLBACK = "Sorry, I couldn't come up with an answer just now. Please try asking again.";

// Live test against real Gemini (no rule-based equivalent exists for free-text Q&A).
// Usage: node --env-file=.env lib/scripts/testFollowUp.js

const fail = (m: string): never => {
  console.error("FAIL:", m);
  process.exit(1);
};
const ok = (m: string) => console.log("ok  ", m);

const context: FollowUpContext = {
  disease: "black spot",
  severity: "high",
  confidence: 0.92,
  advisory:
    "Your crop shows a severe infection of black spot disease. Remove and destroy infected leaves. Spray a copper-based fungicide or mancozeb. Avoid overhead watering.",
  location: "lat 20.59, lng 78.96",
};

const OFF_TOPIC_PHRASES = [
  "sorry", "unable", "can't help", "cannot help", "only help", "only answer", "crop", "diagnosis", "off-topic",
  "outside", "not related", "unrelated", "focus on", "stick to",
];

async function main() {
  if (process.argv.includes("--off-topic-only")) {
    console.log("--- off-topic question only (re-run after a quota failure) ---");
    const offTopic = await askFollowUp(context, "What's the capital of France?");
    console.log("Q: What's the capital of France?\nA:", offTopic);
    if (offTopic === FALLBACK) fail(`still the ERROR FALLBACK string — try again later: "${offTopic}"`);
    const declined = OFF_TOPIC_PHRASES.some((p) => offTopic.toLowerCase().includes(p)) && !offTopic.toLowerCase().includes("paris");
    if (!declined) fail(`off-topic question was not clearly declined: "${offTopic}"`);
    ok("off-topic question declined gracefully, did not just answer with Paris");
    return;
  }

  console.log("--- realistic farmer questions ---");

  const safety = await askFollowUp(context, "Is it safe to eat tomatoes from this plant?");
  console.log("Q: Is it safe to eat tomatoes from this plant?\nA:", safety);
  if (safety.length < 10) fail("safety answer too short/empty");
  ok("safety question answered with a real, non-empty response");

  const cost = await askFollowUp(context, "What if I don't have money for copper fungicide, is there a cheaper option?");
  console.log("\nQ: cheaper option than copper fungicide?\nA:", cost);
  if (cost.length < 10) fail("cost question answer too short/empty");
  ok("cost-effective-alternative question answered");

  const timing = await askFollowUp(context, "How many days until I see improvement after spraying?");
  console.log("\nQ: how many days until improvement?\nA:", timing);
  if (timing.length < 10) fail("timing question answer too short/empty");
  ok("timing question answered");

  console.log("\n--- off-topic question (must decline, not just answer anything) ---");
  const offTopic = await askFollowUp(context, "What's the capital of France?");
  console.log("Q: What's the capital of France?\nA:", offTopic);
  // Guard against a false pass: the API-error fallback sentence happens to contain some of the same words
  // as a genuine decline ("sorry", "answer"), so a quota/network failure must never be counted as a pass.
  if (offTopic === FALLBACK) fail(`this was the ERROR FALLBACK string, not a real model answer — the check is inconclusive, not passed: "${offTopic}"`);
  const declined = OFF_TOPIC_PHRASES.some((p) => offTopic.toLowerCase().includes(p)) && !offTopic.toLowerCase().includes("paris");
  if (!declined) fail(`off-topic question was not clearly declined: "${offTopic}"`);
  ok("off-topic question declined gracefully, did not just answer with Paris");

  console.log("\nall follow-up agent checks passed");
}

main().catch((e) => fail(String(e?.stack ?? e)));
