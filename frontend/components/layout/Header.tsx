"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Leaf, Languages, Menu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSeen } from "@/lib/seen";
import { LANGUAGES, isLangCode } from "@/lib/languages";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", key: "nav.diagnose" },
  { href: "/map", key: "nav.map" },
  { href: "/alerts", key: "nav.alerts" },
] as const;

function NavLink({
  href,
  active,
  label,
  badge,
  onClick,
  className,
  layoutId,
}: {
  href: string;
  active: boolean;
  label: string;
  badge?: number;
  onClick?: () => void;
  className?: string;
  layoutId: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active ? "text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative">{label}</span>
      {!!badge && (
        <span className="relative grid min-w-5 place-items-center rounded-full bg-severity-high px-1.5 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Header() {
  const { t, lang, setLang } = useI18n();
  const path = usePathname();
  const { unseenCount } = useSeen();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on route change so it doesn't stay open after navigating.
  useEffect(() => setMenuOpen(false), [path]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-primary">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <span className="text-lg">AgriVision</span>
        </Link>

        <nav className="hidden gap-1 sm:flex">
          {NAV.map(({ href, key }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <NavLink
                key={href}
                href={href}
                active={active}
                label={t(key)}
                badge={href === "/alerts" ? unseenCount : undefined}
                layoutId="nav-active-desktop"
              />
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <label className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <Languages className="size-4" aria-hidden />
            <span className="sr-only">{t("lang.label")}</span>
            <select
              value={lang}
              onChange={(e) => isLangCode(e.target.value) && setLang(e.target.value)}
              className="rounded-lg border bg-card px-2.5 py-1.5 text-foreground focus:outline-2 focus:outline-ring"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            className="relative grid size-9 place-items-center rounded-lg border bg-card text-foreground sm:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={menuOpen ? "close" : "open"}
                initial={{ opacity: 0, rotate: -45 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 45 }}
                transition={{ duration: 0.15 }}
                className="grid place-items-center"
              >
                {menuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
              </motion.span>
            </AnimatePresence>
            {!menuOpen && unseenCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-4.5 place-items-center rounded-full bg-severity-high px-1 text-[10px] font-semibold text-white">
                {unseenCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t sm:hidden"
          >
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              {NAV.map(({ href, key }) => {
                const active = href === "/" ? path === "/" : path.startsWith(href);
                return (
                  <NavLink
                    key={href}
                    href={href}
                    active={active}
                    label={t(key)}
                    badge={href === "/alerts" ? unseenCount : undefined}
                    onClick={() => setMenuOpen(false)}
                    layoutId="nav-active-mobile"
                  />
                );
              })}
              <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Languages className="size-4" aria-hidden />
                <span className="sr-only">{t("lang.label")}</span>
                <select
                  value={lang}
                  onChange={(e) => isLangCode(e.target.value) && setLang(e.target.value)}
                  className="w-full rounded-lg border bg-card px-2.5 py-1.5 text-foreground focus:outline-2 focus:outline-ring"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
