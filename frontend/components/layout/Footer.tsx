"use client";
import { Leaf } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
        <Leaf className="size-4 text-primary" />
        <span>AgriVision — {t("footer")}</span>
      </div>
    </footer>
  );
}
