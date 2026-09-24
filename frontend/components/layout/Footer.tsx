"use client";
import Link from "next/link";
import { ArrowUpRight, Database, Leaf } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

// Same slim one-row footer as before; the data link is now a green pill button.
export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t bg-gradient-to-b from-transparent to-[#e3f0de]/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-5 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Leaf className="size-4 text-primary" />
          AgriVision — {t("footer")}
        </span>
        <Link
          href="/data"
          className="group ml-auto inline-flex items-center gap-2 rounded-full border border-primary/25 bg-gradient-to-br from-[#d5ebd0] via-white to-[#e6f3e2] px-4 py-2 font-medium text-primary shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_6px_18px_-4px_rgba(47,107,58,0.35)]"
        >
          <Database className="size-4" />
          Regional data
          <span className="hidden font-normal text-muted-foreground sm:inline">· researchers &amp; policymakers</span>
          <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </footer>
  );
}
