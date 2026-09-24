"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LANGUAGES, isLangCode } from "@/lib/languages";
import { cn } from "@/lib/utils";

// Custom language dropdown: glass pill trigger + animated popover list (replaces the native <select>).
export default function LanguageMenu() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative hidden sm:block">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang.label")}
        whileHover={{ scale: 1.04, y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur-md transition-colors",
          open ? "border-primary bg-primary text-primary-foreground" : "border-primary/15 bg-white/60 text-primary hover:bg-primary/10"
        )}
      >
        <Languages className="size-4" aria-hidden />
        {current.label}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="grid">
          <ChevronDown className="size-4" aria-hidden />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-50 mt-2 w-44 space-y-0.5 rounded-2xl border border-primary/15 bg-white/85 p-1.5 shadow-lg shadow-primary/10 backdrop-blur-xl"
          >
            {LANGUAGES.map((l) => {
              const selected = l.code === lang;
              return (
                <li key={l.code} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isLangCode(l.code)) setLang(l.code);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-sm transition-colors",
                      selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {l.label}
                    {selected && <Check className="size-4" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
