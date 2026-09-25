"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { LockKeyhole } from "lucide-react";
import PhoneLogin from "@/components/auth/PhoneLogin";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";

// Dedicated login page (reached from the header user icon when logged out). Once logged in, go on to the diagnose page.
export default function LoginView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/diagnose");
  }, [user, router]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-md rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/10 to-primary/[0.06] p-6 text-center shadow-lg shadow-primary/10 backdrop-blur-xl md:p-8"
    >
      <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
        <LockKeyhole className="size-6" />
      </span>
      <h1 className="text-lg font-semibold">{t("login.title")}</h1>
      <p className="mx-auto mb-5 mt-1 max-w-sm text-sm text-muted-foreground">{t("login.subtitle")}</p>
      <PhoneLogin />
      <p className="mx-auto mt-4 max-w-sm text-xs text-muted-foreground">{t("auth.hint")}</p>
    </motion.section>
  );
}
