"use client";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Leaf className="size-4 text-primary" />
          AgriVision — {t("footer")}
        </span>
        <Link href="/data" className="ml-auto underline-offset-2 hover:underline">
          Regional data (for researchers &amp; policymakers)
        </Link>
      </div>
    </footer>
  );
}
