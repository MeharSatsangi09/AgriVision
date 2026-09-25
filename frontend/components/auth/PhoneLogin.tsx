"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { KeyRound, Loader2, Smartphone } from "lucide-react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useI18n } from "@/lib/i18n/I18nProvider";

// Phone-number OTP login (Firebase Auth phone provider): number -> SMS code -> verified.
// India-only (+91), matching the app's audience; the number is used only to sign in and is never stored in reports.
const INDIA_MOBILE = /^\d{10}$/; // any 10 digits: Firebase itself validates the number, and test numbers like 1234567890 must work

function errorKey(code: string | undefined) {
  switch (code) {
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return "auth.err.phone";
    case "auth/invalid-verification-code":
    case "auth/code-expired":
    case "auth/missing-verification-code":
      return "auth.err.code";
    case "auth/too-many-requests":
    case "auth/quota-exceeded":
      return "auth.err.many";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
    case "auth/unauthorized-domain":
    case "auth/captcha-check-failed":
      return "auth.err.setup";
    default:
      return "auth.err.failed";
  }
}

export default function PhoneLogin() {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  // The invisible reCAPTCHA must be released when the form goes away or is retried.
  const clearVerifier = () => {
    verifier.current?.clear();
    verifier.current = null;
  };
  useEffect(() => clearVerifier, []);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!INDIA_MOBILE.test(phone)) return setError(t("auth.err.phone"));
    setBusy(true);
    try {
      clearVerifier();
      if (!holder.current) throw new Error("no recaptcha holder");
      holder.current.innerHTML = ""; // a fresh element each time: reCAPTCHA can't render twice into one node
      const el = document.createElement("div");
      holder.current.appendChild(el);
      verifier.current = new RecaptchaVerifier(auth, el, { size: "invisible" });
      setConfirmation(await signInWithPhoneNumber(auth, `+91${phone}`, verifier.current));
    } catch (err) {
      clearVerifier();
      setError(t(errorKey((err as { code?: string }).code)));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!confirmation) return;
    setError("");
    if (!/^\d{6}$/.test(code)) return setError(t("auth.err.code"));
    setBusy(true);
    try {
      await confirmation.confirm(code); // success flips AuthProvider's user, which unlocks the gated content
    } catch (err) {
      setError(t(errorKey((err as { code?: string }).code)));
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-primary/25 bg-white/70 px-3 py-2.5 text-base outline-none backdrop-blur-sm transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  const button =
    "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mx-auto w-full max-w-sm text-left">
      {!confirmation ? (
        <form onSubmit={sendCode} className="space-y-3" noValidate>
          <label className="block text-sm font-medium" htmlFor="login-phone">
            {t("auth.phone")}
          </label>
          <div className="flex items-stretch gap-2">
            <span className="grid place-items-center rounded-xl border border-primary/25 bg-white/60 px-3 text-sm font-medium text-muted-foreground">+91</span>
            <input
              id="login-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="98765 43210"
              className={field}
            />
          </div>
          <motion.button type="submit" disabled={busy} whileHover={busy ? undefined : { y: -1 }} whileTap={busy ? undefined : { scale: 0.98 }} className={button}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
            {busy ? t("auth.sending") : t("auth.sendCode")}
          </motion.button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3" noValidate>
          <label className="block text-sm font-medium" htmlFor="login-code">
            {t("auth.code")}
          </label>
          <p className="text-xs text-muted-foreground">{t("auth.codeSent")}</p>
          <input
            id="login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className={`${field} text-center tracking-[0.4em]`}
          />
          <motion.button type="submit" disabled={busy} whileHover={busy ? undefined : { y: -1 }} whileTap={busy ? undefined : { scale: 0.98 }} className={button}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {busy ? t("auth.verifying") : t("auth.verify")}
          </motion.button>
          <button
            type="button"
            onClick={() => {
              setConfirmation(null);
              setCode("");
              setError("");
            }}
            className="w-full text-center text-sm text-primary underline-offset-2 hover:underline"
          >
            {t("auth.change")}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-severity-high/10 p-2.5 text-sm text-severity-high">
          {error}
        </p>
      )}
      <div ref={holder} />
    </div>
  );
}
