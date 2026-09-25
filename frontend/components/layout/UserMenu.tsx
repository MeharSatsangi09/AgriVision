"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { FileText, LogOut, UserCog, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "grid size-10 place-items-center rounded-full border shadow-sm backdrop-blur-md transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_18px_4px_rgba(47,107,58,0.4)]";

// Account control (desktop), always in the same place. Logged out: the user icon opens the login page.
// Logged in: the icon opens a small menu: Profile, My Reports, a divider line, then Log out.
export default function UserMenu() {
  const { t } = useI18n();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  const motionProps = {
    whileHover: { scale: 1.06, y: -1 },
    whileTap: { scale: 0.95 },
    transition: { type: "spring" as const, stiffness: 400, damping: 20 },
  };

  // Logged out (or still checking the saved session): same icon, same spot; it leads to the login page.
  if (!user) {
    return (
      <motion.div {...motionProps} className="hidden sm:block">
        <Link
          href="/login"
          aria-label={t("auth.login")}
          title={t("auth.login")}
          aria-disabled={loading}
          className={cn(ICON_BUTTON, "border-primary/15 bg-white/60 text-primary hover:bg-primary/10")}
        >
          <UserRound className="size-5" aria-hidden />
        </Link>
      </motion.div>
    );
  }

  const item = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 hover:text-primary";
  return (
    <div ref={root} className="relative hidden sm:block">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account.menu")}
        {...motionProps}
        className={cn(ICON_BUTTON, open ? "border-primary bg-primary text-primary-foreground" : "border-primary/15 bg-white/60 text-primary hover:bg-primary/10")}
      >
        <UserRound className="size-5" aria-hidden />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-primary/15 bg-white/85 p-1.5 shadow-lg shadow-primary/10 backdrop-blur-xl"
          >
            <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className={item}>
              <UserCog className="size-4" aria-hidden /> {t("nav.profile")}
            </Link>
            <Link href="/my-reports" role="menuitem" onClick={() => setOpen(false)} className={item}>
              <FileText className="size-4" aria-hidden /> {t("nav.myReports")}
            </Link>
            <div role="separator" className="my-1 h-px bg-primary/15" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className={item}
            >
              <LogOut className="size-4" aria-hidden /> {t("auth.logout")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
