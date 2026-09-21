import { GoogleAuth } from "google-auth-library";

// Regional languages offered in the UI (must match frontend/lib/languages.ts).
export const LANGS = ["hi", "mr", "ta", "te", "bn", "gu", "kn", "pa"] as const;
export type Lang = (typeof LANGS)[number];

export const isLang = (s: unknown): s is Lang => LANGS.includes(s as Lang);

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-translation"] });

// Cloud Translation API v2, authenticated with the function's service account (no API key).
export async function translateTexts(texts: string[], target: Lang): Promise<string[]> {
  const client = await auth.getClient();
  const res = await client.request<{ data: { translations: { translatedText: string }[] } }>({
    url: "https://translation.googleapis.com/language/translate/v2",
    method: "POST",
    data: { q: texts, target, source: "en", format: "text" },
  });
  return res.data.data.translations.map((t) => t.translatedText);
}
