"use client";
import { useEffect, useState, type FormEvent } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Check, Loader2, Save } from "lucide-react";
import { db, isDemoMode } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/I18nProvider";

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

type Profile = { firstName: string; lastName: string; place: string; district: string; state: string };
const EMPTY: Profile = { firstName: "", lastName: "", place: "", district: "", state: "" };
const MAX = 60;

// The user's private profile, saved at users/{uid} (only that user can read or write it: see firestore.rules).
// It is never shown on reports, the map or any public list. The phone number is shown from the login and not stored here.
export default function ProfileView() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [form, setForm] = useState<Profile>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!user || isDemoMode) return setLoaded(true);
    let live = true;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => live && snap.exists() && setForm({ ...EMPTY, ...(snap.data() as Partial<Profile>) }))
      .catch(() => {})
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [user]);

  const set = (k: keyof Profile) => (v: string) => {
    setState("idle");
    setForm((f) => ({ ...f, [k]: v.slice(0, MAX) }));
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user || isDemoMode) return;
    setState("saving");
    try {
      const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
      await setDoc(doc(db, "users", user.uid), { ...clean, updatedAt: new Date().toISOString() });
      setState("saved");
    } catch {
      setState("error");
    }
  }

  const field =
    "w-full rounded-xl border border-primary/25 bg-white/70 px-3 py-2 text-sm outline-none backdrop-blur-sm transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  const label = "mb-1 block text-sm font-medium";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("profile.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <form onSubmit={save} className="space-y-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-white/60 to-primary/[0.05] p-5 shadow-sm backdrop-blur-xl md:p-6">
        <div>
          <span className={label}>{t("profile.phone")}</span>
          <p className="rounded-xl border border-primary/15 bg-white/50 px-3 py-2 text-sm text-muted-foreground">{user?.phoneNumber ?? "—"}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-first" className={label}>{t("profile.firstName")}</label>
            <input id="pf-first" autoComplete="given-name" value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} disabled={!loaded} className={field} />
          </div>
          <div>
            <label htmlFor="pf-last" className={label}>{t("profile.lastName")}</label>
            <input id="pf-last" autoComplete="family-name" value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} disabled={!loaded} className={field} />
          </div>
          <div>
            <label htmlFor="pf-place" className={label}>{t("profile.place")}</label>
            <input id="pf-place" value={form.place} onChange={(e) => set("place")(e.target.value)} disabled={!loaded} className={field} />
          </div>
          <div>
            <label htmlFor="pf-district" className={label}>{t("profile.district")}</label>
            <input id="pf-district" value={form.district} onChange={(e) => set("district")(e.target.value)} disabled={!loaded} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pf-state" className={label}>{t("profile.state")}</label>
            <select id="pf-state" value={form.state} onChange={(e) => set("state")(e.target.value)} disabled={!loaded} className={field}>
              <option value="">{t("profile.chooseState")}</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!loaded || state === "saving"}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {state === "saving" ? t("profile.saving") : t("profile.save")}
          </button>
          {state === "saved" && (
            <span className="inline-flex items-center gap-1 text-sm text-primary">
              <Check className="size-4" /> {t("profile.saved")}
            </span>
          )}
          {state === "error" && <span role="alert" className="text-sm text-severity-high">{t("profile.error")}</span>}
        </div>
      </form>
    </div>
  );
}
