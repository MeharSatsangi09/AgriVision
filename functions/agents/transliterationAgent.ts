import { LlmAgent, InMemoryRunner } from "@google/adk";
import { MODEL } from "./diagnosisAgent";

const APP = "transliterate";
const TIMEOUT_MS = 20_000;
const MAX_CHARS = 80;

export const SCRIPT_NAMES: Record<string, string> = {
  en: "English (Latin letters)",
  hi: "Hindi (Devanagari script)",
  mr: "Marathi (Devanagari script)",
  ta: "Tamil (Tamil script)",
  te: "Telugu (Telugu script)",
  bn: "Bengali (Bengali script)",
  gu: "Gujarati (Gujarati script)",
  kn: "Kannada (Kannada script)",
  pa: "Punjabi (Gurmukhi script)",
};

// Shows a user's own typed name / village / district in the language the site is in. This is transliteration (write the
// same name in another script), NOT translation: machine translation turns "Abha" into the word for "river".
export const transliterationAgent = new LlmAgent({
  name: "transliteration_agent",
  model: MODEL,
  description: "Writes Indian personal names and place names in another script.",
  instruction: `You write people's names and Indian place names (village, town, district) in the script of another language.
Target: {language}.

Rules:
- TRANSLITERATE, never translate meanings. "Abha" is a person's name, not the word for "river"; "Kalamb" is a village name.
- Keep the pronunciation a local reader would expect (e.g. "Yamuna Nagar" -> "यमुना नगर" in Hindi).
- If a value is already in the target script, return it unchanged. Preserve spacing between words.
- The user message is a JSON object of {field: text}. Reply with ONLY a JSON object with exactly the same keys and the transliterated text as values. No commentary, no markdown.`,
  generateContentConfig: { responseMimeType: "application/json" },
});

// Returns the transliterated fields, or null if anything goes wrong (the caller then just shows the original text).
export async function transliterate(fields: Record<string, string>, lang: string): Promise<Record<string, string> | null> {
  const language = SCRIPT_NAMES[lang];
  if (!language) return null;
  try {
    const runner = new InMemoryRunner({ agent: transliterationAgent, appName: APP });
    const sessionId = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await runner.sessionService.createSession({ appName: APP, userId: "user", sessionId, state: { language } });

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let text = "";
    try {
      for await (const ev of runner.runAsync({
        userId: "user",
        sessionId,
        abortSignal: ctl.signal,
        newMessage: { role: "user", parts: [{ text: JSON.stringify(fields) }] },
      })) {
        if (ev.errorCode) throw new Error(`${ev.author}: ${ev.errorCode} ${ev.errorMessage ?? ""}`);
        const part = ev.content?.parts?.map((p) => p.text ?? "").join("").trim();
        if (part && ev.author === "transliteration_agent") text = part;
      }
    } finally {
      clearTimeout(timer);
    }
    return parseTransliteration(text, Object.keys(fields));
  } catch (err) {
    console.error("transliteration failed:", err);
    return null;
  }
}

// Tolerant of code fences; accepts only string values for the requested keys, each short. Anything else -> null.
export function parseTransliteration(raw: string, keys: string[]): Record<string, string> | null {
  try {
    const json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = (json as Record<string, unknown>)[k];
      if (typeof v !== "string" || !v.trim() || v.length > MAX_CHARS) return null;
      out[k] = v.trim();
    }
    return out;
  } catch {
    return null;
  }
}
