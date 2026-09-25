"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { FileText, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

// Desktop account menu (logged-in only): user icon -> small popover with "My Reports" and "Log out".
export default function UserMenu() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
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

  if (!user) return null;

  const item = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 hover:text-primary";
  return (
    <div ref={root} className="relative hidden sm:block">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account.menu")}
        whileHover={{ scale: 1.06, y: -1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={cn(
          "grid size-10 place-items-center rounded-full border shadow-sm backdrop-blur-md transition-colors",
          open ? "border-primary bg-primary text-primary-foreground" : "border-primary/15 bg-white/60 text-primary hover:bg-primary/10"
        )}
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
            className="absolute right-0 top-full z-50 mt-2 w-48 space-y-0.5 rounded-2xl border border-primary/15 bg-white/85 p-1.5 shadow-lg shadow-primary/10 backdrop-blur-xl"
          >
            <Link href="/my-reports" role="menuitem" onClick={() => setOpen(false)} className={item}>
              <FileText className="size-4" aria-hidden /> {t("nav.myReports")}
            </Link>
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
