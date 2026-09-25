"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Loader2, LockKeyhole } from "lucide-react";
import PhoneLogin from "@/components/auth/PhoneLogin";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";

// Shows its children only to a logged-in user; everyone else sees a phone-OTP login prompt in its place.
export default function AuthGate({ titleKey, children }: { titleKey: "auth.uploadTitle" | "auth.alertsTitle" | "auth.myReportsTitle" | "auth.profileTitle"; children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t("auth.checking")}
      </div>
    );
  }
  if (user) return <>{children}</>;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      id="upload"
      className="scroll-mt-24 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/10 to-primary/[0.06] p-6 text-center shadow-lg shadow-primary/10 backdrop-blur-xl md:p-8"
    >
      <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
        <LockKeyhole className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">{t(titleKey)}</h2>
      <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-muted-foreground">{t("auth.hint")}</p>
      <PhoneLogin />
    </motion.section>
  );
}
