import { parseAdvisory } from "../agents/advisoryAgent";

// Offline test of parseAdvisory against messy raw model text — no Gemini call, safe to run any time.
// Usage: node lib/scripts/testAdvisoryParse.js

const fail = (m: string): never => {
  console.error("FAIL:", m);
  process.exit(1);
};
const ok = (m: string) => console.log("ok  ", m);

function eq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  ok(label);
}

// Clean JSON, both fields present.
eq(
  parseAdvisory('{"advisory": "Spray copper fungicide.", "regenerativeTip": "Rotate with a non-host crop next season."}'),
  { advisory: "Spray copper fungicide.", regenerativeTip: "Rotate with a non-host crop next season." },
  "clean JSON with both fields"
);

// Code-fenced JSON (a common raw-model quirk, same as diagnosisAgent's parser handles).
eq(
  parseAdvisory('```json\n{"advisory": "Remove infected leaves.", "regenerativeTip": "Use a neem-oil spray instead of a chemical fungicide."}\n```'),
  { advisory: "Remove infected leaves.", regenerativeTip: "Use a neem-oil spray instead of a chemical fungicide." },
  "code-fenced JSON"
);

// Healthy/Unclear diagnoses should have no tip (empty string per the instruction) -> field omitted.
eq(parseAdvisory('{"advisory": "Your plant looks healthy.", "regenerativeTip": ""}'), { advisory: "Your plant looks healthy." }, "empty regenerativeTip omitted");

// Missing regenerativeTip key entirely.
eq(parseAdvisory('{"advisory": "Keep monitoring."}'), { advisory: "Keep monitoring." }, "missing regenerativeTip key omitted");

// Malformed JSON falls back to treating the raw text as the advisory, no tip.
eq(parseAdvisory("Not JSON at all, just a sentence."), { advisory: "Not JSON at all, just a sentence." }, "malformed JSON falls back to raw text");

// Non-string input (e.g. undefined session state) doesn't throw.
eq(parseAdvisory(undefined), { advisory: "" }, "undefined input");

// regenerativeTip longer than 300 chars gets truncated, not dropped.
const longTip = "x".repeat(400);
const parsedLong = parseAdvisory(JSON.stringify({ advisory: "ok", regenerativeTip: longTip }));
if (parsedLong.regenerativeTip?.length !== 300) fail(`long tip should truncate to 300 chars, got ${parsedLong.regenerativeTip?.length}`);
ok("long regenerativeTip truncated to 300 chars");

console.log("\nall parseAdvisory checks passed");
