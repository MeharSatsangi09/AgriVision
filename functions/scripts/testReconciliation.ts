import { categoryOf } from "../tools/reconciliationTools";
import { reconcile, ruleBasedReconciliation, parseReconciliation, type ReconciliationInput } from "../agents/reconciliationAgent";

// Usage: node lib/scripts/testReconciliation.js        -> unit tests only (fast, no network)
//        node lib/scripts/testReconciliation.js --live -> also runs the real LlmAgent against Gemini
//                                                          for the 3 documented scenarios

const fail = (m: string): never => {
  console.error("FAIL:", m);
  process.exit(1);
};
const ok = (m: string) => console.log("ok  ", m);

// --- categoryOf
const CATS: [string, string][] = [
  ["Healthy", "healthy"], ["Unclear", "unclear"], ["Leaf curl virus", "viral"], ["Mosaic virus", "viral"],
  ["Bacterial blight", "bacterial"], ["Bacterial leaf spot", "bacterial"], ["Spider mite damage", "pest"],
  ["Nutrient deficiency", "nutrient_abiotic"], ["Wilt", "fungal"], ["Black spot", "fungal"], ["Powdery mildew", "fungal"],
  ["Leaf rust", "fungal"], ["Rice blast", "fungal"], ["Anthracnose", "fungal"], ["Apple scab", "fungal"], ["Black rot", "fungal"],
  ["Some totally novel thing", "other"],
];
for (const [name, want] of CATS) if (categoryOf(name) !== want) fail(`categoryOf("${name}") = ${categoryOf(name)}, want ${want}`);
ok(`categoryOf: ${CATS.length} cases`);

// --- ruleBasedReconciliation: the 5 branches, matching the task's 3 documented cases plus 2 sensible extras
const base: ReconciliationInput = {
  geminiDisease: "black spot", geminiSeverity: "high", geminiConfidence: 0.9, geminiNeedsReview: false,
  classifierCondition: "Black spot", classifierConfidence: 0.95, classifierLowConfidence: false,
};

// 1. Agree -> deferred_to_gemini, agreedWithClassifier true
let r = ruleBasedReconciliation(base);
if (r.action !== "deferred_to_gemini" || !r.agreedWithClassifier) fail(`agree case: ${JSON.stringify(r)}`);
ok("rule: agree -> deferred_to_gemini, agreedWithClassifier=true");

// 2. Disagree, both confident -> confident (documented case: "both disagree and both confident")
r = ruleBasedReconciliation({ ...base, classifierCondition: "Late blight" });
if (r.action !== "confident") fail(`disagree-both-confident case: ${JSON.stringify(r)}`);
ok("rule: disagree + both confident -> confident");

// 3. Disagree, both low-confidence -> request_clearer_photo (documented case: don't fake an answer)
r = ruleBasedReconciliation({
  ...base, classifierCondition: "Late blight", geminiNeedsReview: true, geminiConfidence: 0.3,
  classifierLowConfidence: true, classifierConfidence: 0.4,
});
if (r.action !== "request_clearer_photo" || r.finalDiagnosis !== "") fail(`disagree-both-low case: ${JSON.stringify(r)}`);
ok("rule: disagree + both low-confidence -> request_clearer_photo, no faked answer");

// 4. Classifier low-confidence only -> deferred_to_gemini (documented: "or classifier is low-confidence")
r = ruleBasedReconciliation({ ...base, classifierCondition: "Late blight", classifierLowConfidence: true, classifierConfidence: 0.5 });
if (r.action !== "deferred_to_gemini" || r.finalDiagnosis !== base.geminiDisease) fail(`classifier-low-only case: ${JSON.stringify(r)}`);
ok("rule: classifier low-confidence only -> deferred_to_gemini");

// 5. Gemini low-confidence only (classifier confident+specific) -> confident, uses the classifier's answer
r = ruleBasedReconciliation({ ...base, classifierCondition: "Late blight", geminiNeedsReview: true, geminiConfidence: 0.4 });
if (r.action !== "confident" || r.finalDiagnosis !== "Late blight" || !r.agreedWithClassifier) fail(`gemini-low-only case: ${JSON.stringify(r)}`);
ok("rule: gemini low-confidence only -> confident, uses the classifier's specific answer");

// --- parseReconciliation: messy LLM output shapes
const fb = ruleBasedReconciliation(base);
const cases: [string, Partial<import("../agents/reconciliationAgent").Reconciliation>][] = [
  [JSON.stringify({ finalDiagnosis: "Late blight", reasoning: "x", action: "confident", agreedWithClassifier: true }),
    { finalDiagnosis: "Late blight", action: "confident", agreedWithClassifier: true }],
  ["```json\n" + JSON.stringify({ finalDiagnosis: "A", reasoning: "b", action: "deferred_to_gemini", agreedWithClassifier: false }) + "\n```",
    { finalDiagnosis: "A", action: "deferred_to_gemini" }],
  [JSON.stringify({ finalDiagnosis: "A", reasoning: "b", action: "not_a_real_action", agreedWithClassifier: true }), { action: fb.action }],
  ["not json at all", { action: fb.action, finalDiagnosis: fb.finalDiagnosis }],
  ["", { action: fb.action }],
];
for (const [raw, want] of cases) {
  const got = parseReconciliation(raw, fb);
  for (const [k, v] of Object.entries(want)) if ((got as any)[k] !== v) fail(`parseReconciliation(${JSON.stringify(raw).slice(0, 40)}...) .${k} = ${(got as any)[k]}, want ${v}`);
}
ok(`parseReconciliation: ${cases.length} messy/invalid shapes handled`);

console.log("\nall offline reconciliation checks passed");

if (process.argv.includes("--live")) {
  (async () => {
    console.log("\n--- live Gemini runs (3 documented scenarios) ---");

    const agree = await reconcile({
      geminiDisease: "late blight", geminiSeverity: "high", geminiConfidence: 0.9, geminiNeedsReview: false,
      classifierCondition: "Late blight", classifierConfidence: 0.95, classifierLowConfidence: false,
    });
    console.log("1) AGREE case:", JSON.stringify(agree));
    if (agree.action !== "deferred_to_gemini") fail(`live agree case did not defer: ${JSON.stringify(agree)}`);
    ok("live: agree -> deferred_to_gemini");

    const disagreeConfident = await reconcile({
      geminiDisease: "black spot", geminiSeverity: "high", geminiConfidence: 0.9, geminiNeedsReview: false,
      classifierCondition: "Early blight", classifierConfidence: 0.98, classifierLowConfidence: false,
    });
    console.log("2) DISAGREE, both confident:", JSON.stringify(disagreeConfident));
    if (disagreeConfident.action !== "confident") fail(`live disagree-confident case: ${JSON.stringify(disagreeConfident)}`);
    ok("live: disagree + both confident -> confident (adjudicated, not just displayed side by side)");

    const bothLow = await reconcile({
      geminiDisease: "unclear", geminiSeverity: "low", geminiConfidence: 0.25, geminiNeedsReview: true,
      classifierCondition: "Tomato mosaic virus", classifierConfidence: 0.5, classifierLowConfidence: true,
    });
    console.log("3) BOTH low-confidence:", JSON.stringify(bothLow));
    if (bothLow.action !== "request_clearer_photo" || bothLow.finalDiagnosis !== "") fail(`live both-low case: ${JSON.stringify(bothLow)}`);
    ok("live: both low-confidence -> request_clearer_photo, no faked answer");

    console.log("\nall live reconciliation checks passed");
  })().catch((e) => fail(String(e?.stack ?? e)));
}
