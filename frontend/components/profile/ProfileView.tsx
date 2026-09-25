"use client";
import { useEffect, useState, type FormEvent } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Check, Loader2, Pencil, Save } from "lucide-react";
import { db, functions, isDemoMode } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { STATE_VALUES, stateLabel } from "@/lib/states";

type Profile = { firstName: string; lastName: string; place: string; district: string; state: string };
type TextFields = Pick<Profile, "firstName" | "lastName" | "place" | "district">;
const EMPTY: Profile = { firstName: "", lastName: "", place: "", district: "", state: "" };
const MAX = 60;
const hasAny = (p: Profile) => Object.values(p).some((v) => v.trim());
const ASCII_ONLY = /^[\x00-\x7F]*$/;

// The user's private profile, saved at users/{uid} (only that user can read or write it: see firestore.rules).
// It is never shown on reports, the map or any public list. The phone number is shown from the login and not stored here.
// Viewing mode shows the values in the site's language (names and places are TRANSLITERATED by the translateProfile
// function; the state list is translated statically). Editing shows exactly what was typed.
export default function ProfileView() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [saved, setSaved] = useState<Profile>(EMPTY); // exactly what is stored
  const [form, setForm] = useState<Profile>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shown, setShown] = useState<Partial<TextFields>>({}); // the same text in the site's language
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!user || isDemoMode) {
      setEditing(true);
      return setLoaded(true);
    }
    let live = true;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (!live) return;
        const p = { ...EMPTY, ...(snap.exists() ? (snap.data() as Partial<Profile>) : {}) };
        setSaved(p);
        setForm(p);
        setEditing(!hasAny(p));
      })
      .catch(() => live && setEditing(true))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [user]);

  // Ask the server for the saved text in the current language (cached there per language). Text that is already plain
  // English needs no call when the site is in English. Any failure just leaves the typed text on screen.
  useEffect(() => {
    setShown({});
    if (!user || isDemoMode || editing || !hasAny(saved)) return;
    const texts: TextFields = { firstName: saved.firstName, lastName: saved.lastName, place: saved.place, district: saved.district };
    if (lang === "en" && Object.values(texts).every((v) => ASCII_ONLY.test(v))) return;
    let live = true;
    setTranslating(true);
    httpsCallable<{ lang: string }, Partial<TextFields>>(functions, "translateProfile")({ lang })
      .then((res) => live && setShown(res.data ?? {}))
      .catch(() => {})
      .finally(() => live && setTranslating(false));
    return () => {
      live = false;
    };
  }, [user, lang, saved, editing]);

  const set = (k: keyof Profile) => (v: string) => {
    setStatus("idle");
    setForm((f) => ({ ...f, [k]: v.slice(0, MAX) }));
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user || isDemoMode) return;
    setStatus("saving");
    try {
      const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as Profile;
      // Whole-document write: it also drops any cached translations, so they are regenerated from the new text.
      await setDoc(doc(db, "users", user.uid), { ...clean, updatedAt: new Date().toISOString() });
      setSaved(clean);
      setForm(clean);
      setEditing(false);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  const field =
    "w-full rounded-xl border border-primary/25 bg-white/70 px-3 py-2 text-sm outline-none backdrop-blur-sm transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  const label = "mb-1 block text-sm font-medium";
  const card =
    "space-y-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-white/60 to-primary/[0.05] p-5 shadow-sm backdrop-blur-xl md:p-6";
  const text = (k: keyof TextFields) => shown[k] || saved[k];
  const fullName = [text("firstName"), text("lastName")].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("profile.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      {!loaded ? null : !editing ? (
        <div className={card}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row label={t("profile.phone")} value={user?.phoneNumber ?? "—"} />
            <Row label={t("profile.name")} value={fullName || "—"} busy={translating} />
            <Row label={t("profile.place")} value={text("place") || "—"} busy={translating} />
            <Row label={t("profile.district")} value={text("district") || "—"} busy={translating} />
            <Row label={t("profile.state")} value={saved.state ? stateLabel(saved.state, lang) : "—"} />
          </dl>
          <p className="text-xs text-muted-foreground">{t("profile.autoNote")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setForm(saved);
                setStatus("idle");
                setEditing(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/10"
            >
              <Pencil className="size-4" /> {t("profile.edit")}
            </button>
            {status === "saved" && (
              <span className="inline-flex items-center gap-1 text-sm text-primary">
                <Check className="size-4" /> {t("profile.saved")}
              </span>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={save} className={card}>
          <div>
            <span className={label}>{t("profile.phone")}</span>
            <p className="rounded-xl border border-primary/15 bg-white/50 px-3 py-2 text-sm text-muted-foreground">{user?.phoneNumber ?? "—"}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-first" className={label}>{t("profile.firstName")}</label>
              <input id="pf-first" autoComplete="given-name" value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="pf-last" className={label}>{t("profile.lastName")}</label>
              <input id="pf-last" autoComplete="family-name" value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="pf-place" className={label}>{t("profile.place")}</label>
              <input id="pf-place" value={form.place} onChange={(e) => set("place")(e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="pf-district" className={label}>{t("profile.district")}</label>
              <input id="pf-district" value={form.district} onChange={(e) => set("district")(e.target.value)} className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pf-state" className={label}>{t("profile.state")}</label>
              <select id="pf-state" value={form.state} onChange={(e) => set("state")(e.target.value)} className={field}>
                <option value="">{t("profile.chooseState")}</option>
                {STATE_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {stateLabel(s, lang)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={status === "saving"}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {status === "saving" ? t("profile.saving") : t("profile.save")}
            </button>
            {hasAny(saved) && (
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-primary underline-offset-2 hover:underline">
                {t("profile.cancel")}
              </button>
            )}
            {status === "error" && <span role="alert" className="text-sm text-severity-high">{t("profile.error")}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label, value, busy }: { label: string; value: string; busy?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-2 text-base">
        {value}
        {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
      </dd>
    </div>
  );
}
