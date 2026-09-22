import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { agreesWith } from "./classifierTool";

export type Category = "fungal" | "bacterial" | "viral" | "pest" | "nutrient_abiotic" | "healthy" | "unclear" | "other";

// Coarse category buckets, independent of exact species/name wording — a second, independent signal from the
// exact-name match in agreesWith() below. Order matters: more specific buckets are checked before "fungal", which
// has the widest net (many disease names literally contain "spot"/"rot" etc.).
const CATEGORY_KEYWORDS: [Category, string[]][] = [
  ["healthy", ["healthy"]],
  ["unclear", ["unclear"]],
  ["viral", ["virus", "viral", "curl", "mosaic"]],
  ["bacterial", ["bacterial", "bacteria", "canker"]],
  ["pest", ["mite", "pest", "insect", "aphid", "borer"]],
  ["nutrient_abiotic", ["nutrient", "deficiency", "abiotic"]],
  ["fungal", ["blight", "mildew", "rust", "spot", "blast", "mold", "mould", "rot", "scab", "anthracnose", "smut", "wilt"]],
];

export function categoryOf(name: string): Category {
  const s = name.toLowerCase();
  for (const [cat, words] of CATEGORY_KEYWORDS) if (words.some((w) => s.includes(w))) return cat;
  return "other";
}

export interface ReconciliationInput {
  geminiDisease: string;
  classifierCondition: string;
}

// Two small, deterministic tools the Reconciliation Agent calls itself (tool-calling, not pre-computed reasoning)
// to gather structured evidence before deciding. Kept simple per classifier-confidence-guard-task.md's "start
// simple, upgrade only if needed" — keyword/category matching, no extra Gemini call.
export function createReconciliationTools(input: ReconciliationInput) {
  const compareSymptoms = new FunctionTool({
    name: "compare_symptoms",
    description:
      "Checks whether Gemini's diagnosis and the classifier's label are plausibly describing the SAME condition (exact/near-exact name match).",
    parameters: z.object({}),
    execute: async () => ({
      sameCondition: agreesWith({ condition: input.classifierCondition }, input.geminiDisease),
      geminiDisease: input.geminiDisease,
      classifierCondition: input.classifierCondition,
    }),
  });

  const checkClassOverlap = new FunctionTool({
    name: "check_class_overlap",
    description:
      "Checks whether Gemini's diagnosis and the classifier's label are even in the same broad category (fungal/bacterial/viral/pest/nutrient/healthy) — guards against the classifier confidently naming an unrelated kind of problem.",
    parameters: z.object({}),
    execute: async () => {
      const geminiCategory = categoryOf(input.geminiDisease);
      const classifierCategory = categoryOf(input.classifierCondition);
      return { geminiCategory, classifierCategory, overlap: geminiCategory === classifierCategory };
    },
  });

  return { compareSymptoms, checkClassOverlap };
}
