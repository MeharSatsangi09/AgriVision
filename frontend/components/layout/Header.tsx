"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSeen } from "@/lib/seen";
import { LANGUAGES, isLangCode } from "@/lib/languages";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", key: "nav.diagnose" },
  { href: "/map", key: "nav.map" },
  { href: "/alerts", key: "nav.alerts" },
] as const;

export default function Header() {
  const { t, lang, setLang } = useI18n();
  const path = usePathname();
  const { unseenCount } = useSeen();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-primary">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <span className="text-lg">AgriVision</span>
        </Link>

        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
          {NAV.map(({ href, key }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {t(key)}
                {href === "/alerts" && unseenCount > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-severity-high px-1.5 text-xs font-semibold text-white">
                    {unseenCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
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
      </div>
    </header>
  );
}
