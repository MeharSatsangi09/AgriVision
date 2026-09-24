"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DICT } from "@/lib/i18n/dict";
import { isLangCode, type LangCode } from "@/lib/languages";
import { httpsCallable } from "firebase/functions";
import { functions, isDemoMode } from "@/lib/firebase";

interface I18n {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");
  const [remoteDicts, setRemoteDicts] = useState<Record<string, Record<string, string>>>({});

  // Restore the saved language (storage can be unavailable — ignore failures).
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang");
      if (isLangCode(saved)) setLangState(saved);
    } catch { }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (lang === "en" || isDemoMode || remoteDicts[lang]) return;
    let cancelled = false;
    const cacheKey = `ui-translations:${lang}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, string>;
        setRemoteDicts((current) => ({ ...current, [lang]: parsed }));
        return;
      }
    } catch { }

    const translateUi = httpsCallable<{ lang: string; entries: Record<string, string> }, Record<string, string>>(functions, "translateUi");
    translateUi({ lang, entries: DICT.en })
      .then(({ data }) => {
        if (cancelled) return;
        setRemoteDicts((current) => ({ ...current, [lang]: data }));
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { }
      })
      .catch(() => {
        // Bundled translations remain active when the callable is unavailable.
      });
    return () => { cancelled = true; };
  }, [lang, remoteDicts]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch { }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = remoteDicts[lang]?.[key] ?? DICT[lang]?.[key] ?? DICT.en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang, remoteDicts]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}
