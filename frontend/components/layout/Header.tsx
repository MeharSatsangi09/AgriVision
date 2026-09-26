"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bell, FileText, Leaf, Languages, LogOut, MapPinned, Menu, ScanSearch, UserCog, UserRound, Wind, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSeen } from "@/lib/seen";
import { useAuth } from "@/lib/auth";
import { useReduceMotion } from "@/lib/reduceMotion";
import { LANGUAGES, isLangCode } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { AnimatedBackground } from "@/components/core/animated-background";
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/core/dock";
import LanguageMenu from "@/components/layout/LanguageMenu";
import UserMenu from "@/components/layout/UserMenu";
import WeatherButton from "@/components/weather/WeatherButton";

const NAV = [
  { href: "/diagnose", key: "nav.diagnose" },
  { href: "/map", key: "nav.map" },
  { href: "/alerts", key: "nav.alerts" },
] as const;

const NAV_ICON = { "/diagnose": ScanSearch, "/map": MapPinned, "/alerts": Bell } as const;

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
      data-id={href}
      className={cn(
        "relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active ? "text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
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
  const { user, logout } = useAuth();
  const { reduce, setReduce } = useReduceMotion();
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

        {/* Apple-style magnifying dock (desktop). Labels open below the items since the header sits at the top edge. */}
        <div className="hidden sm:block">
          <Dock className="border border-primary/10 bg-white/60 shadow-sm backdrop-blur-md" panelHeight={52} magnification={50} distance={110} baseSize={38}>
            {NAV.map(({ href, key }) => {
              const active = path.startsWith(href);
              const Icon = NAV_ICON[href];
              return (
                <Link key={href} href={href} aria-label={t(key)} className="flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <DockItem
                    className={cn(
                      "aspect-square rounded-full border transition-colors",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-primary/10 bg-white text-primary/80"
                    )}
                  >
                    <DockLabel side="bottom" className="border-primary bg-primary text-primary-foreground">{t(key)}</DockLabel>
                    <DockIcon>
                      <Icon className="size-full" />
                    </DockIcon>
                    {href === "/alerts" && unseenCount > 0 && (
                      <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-severity-high px-1 text-[10px] font-semibold leading-4 text-white">
                        {unseenCount}
                      </span>
                    )}
                  </DockItem>
                </Link>
              );
            })}
          </Dock>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LanguageMenu />
          <WeatherButton />
          <UserMenu />

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
            <AnimatedBackground
              key={`mobile-${path}`}
              defaultValue={path === "/" ? "/" : NAV.find((item) => path.startsWith(item.href))?.href}
              enableHover
              className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3"
              transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
            >
              {NAV.map(({ href, key }) => {
                const active = path.startsWith(href);
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
              {!user && (
                <Link href="/login" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  <UserRound className="size-4" aria-hidden /> {t("auth.login")}
                </Link>
              )}
              {user && (
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  <UserCog className="size-4" aria-hidden /> {t("nav.profile")}
                </Link>
              )}
              {user && (
                <Link href="/my-reports" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  <FileText className="size-4" aria-hidden /> {t("nav.myReports")}
                </Link>
              )}
              {user && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={reduce}
                  onClick={() => setReduce(!reduce)}
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary"
                >
                  <Wind className="size-4" aria-hidden /> {t("account.reduceMotion")}
                  <span aria-hidden className={cn("relative h-4 w-7 rounded-full transition-colors", reduce ? "bg-primary" : "bg-primary/20")}>
                    <span className={cn("absolute top-0.5 size-3 rounded-full bg-white shadow transition-all", reduce ? "left-3.5" : "left-0.5")} />
                  </span>
                </button>
              )}
              {user && (
                <button
                  type="button"
                  onClick={() => logout()}
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary"
                >
                  <LogOut className="size-4" aria-hidden /> {t("auth.logout")}
                </button>
              )}
            </AnimatedBackground>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
