"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, ImagePlus, Lightbulb, ScanSearch, TriangleAlert, X } from "lucide-react";
import { Tilt } from "@/components/core/tilt";
import LocationPicker from "@/components/diagnose/LocationPicker";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { assessPhotoQuality, type QualityIssue } from "@/lib/photoQuality";
import type { LatLng } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 8 * 1024 * 1024; // matches storage.rules (files are compressed before upload anyway)

export default function UploadCard({
  error,
  onSubmit,
}: {
  error: string;
  onSubmit: (file: File, location: LatLng) => void;
}) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [problem, setProblem] = useState("");
  const [quality, setQuality] = useState<QualityIssue | null>(null);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [drag, setDrag] = useState(false);
  const pickInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);
  const pickToken = useRef(0); // guards against a stale quality result winning a race if two photos are picked quickly

  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | null | undefined) {
    setProblem("");
    setQuality(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setProblem(t("err.notImage"));
    // Photos are compressed before upload, so only reject truly huge originals.
    if (f.size > MAX_BYTES * 5) return setProblem(t("err.tooBig"));
    setFile(f);
    // Advisory only — never blocks the upload, just nudges toward a better photo. Runs after setFile so the
    // preview shows immediately; the check itself is a few milliseconds on a downscaled canvas.
    const token = ++pickToken.current;
    assessPhotoQuality(f).then((q) => {
      if (token === pickToken.current) setQuality(q);
    });
  }

  const ready = !!file && !!location;

  return (
    <Tilt rotationFactor={2.5} springOptions={{ stiffness: 260, damping: 28 }} className="w-full">
    <section
      id="upload"
      className="scroll-mt-24 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/10 to-primary/[0.06] p-5 shadow-lg shadow-primary/10 backdrop-blur-xl md:p-6"
    >
      <h2 className="mb-4 text-lg font-semibold">{t("upload.title")}</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Photo */}
        <div>
          <motion.div
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            animate={drag ? { scale: 1.015 } : { scale: 1 }}
            whileHover={preview ? undefined : { scale: 1.01, borderColor: "var(--primary)" }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className={cn(
              "relative grid min-h-60 place-items-center overflow-hidden rounded-xl border-2 border-dashed p-4 text-center backdrop-blur-sm transition-colors",
              drag ? "border-primary bg-accent" : "border-border/70 bg-white/40"
            )}
          >
            {preview ? (
              <>
                <motion.img
                  key={preview}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  src={preview}
                  alt=""
                  className="max-h-64 rounded-lg object-contain"
                />
                <motion.button
                  type="button"
                  onClick={() => (setFile(null), setQuality(null))}
                  aria-label={t("upload.change")}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-foreground/70 text-white transition-colors hover:bg-foreground"
                >
                  <X className="size-4" />
                </motion.button>
              </>
            ) : (
              <div className="space-y-3">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  whileHover={{ scale: 1.12, rotate: -6 }}
                  className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10"
                >
                  <ImagePlus className="size-7 text-primary/70" />
                </motion.div>
                <p className="text-sm text-muted-foreground">{t("upload.drop")}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => pickInput.current?.click()}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:opacity-80"
                  >
                    <ImagePlus className="size-4" /> {t("upload.choose")}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => camInput.current?.click()}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <Camera className="size-4" /> {t("upload.camera")}
                  </motion.button>
                </div>
              </div>
            )}
            <input ref={pickInput} type="file" accept="image/*" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
            <input
              ref={camInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))}
            />
          </motion.div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" /> {t("upload.tip")}
          </p>
          {quality && (quality.blurry || quality.dark || quality.bright) && (
            <div className="mt-2 space-y-1">
              {quality.blurry && (
                <p className="flex items-start gap-1.5 rounded-lg bg-severity-medium/10 px-2.5 py-1.5 text-xs text-severity-medium">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {t("upload.quality.blurry")}
                </p>
              )}
              {quality.dark && (
                <p className="flex items-start gap-1.5 rounded-lg bg-severity-medium/10 px-2.5 py-1.5 text-xs text-severity-medium">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {t("upload.quality.dark")}
                </p>
              )}
              {quality.bright && (
                <p className="flex items-start gap-1.5 rounded-lg bg-severity-medium/10 px-2.5 py-1.5 text-xs text-severity-medium">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {t("upload.quality.bright")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Location */}
        <LocationPicker value={location} onChange={setLocation} />
      </div>

      {(problem || error) && (
        <p role="alert" className="mt-4 rounded-lg bg-severity-high/10 p-3 text-sm text-severity-high">
          {problem || error}
        </p>
      )}

      <button
        type="button"
        disabled={!ready}
        onClick={() => file && location && onSubmit(file, location)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        <ScanSearch className="size-5" /> {t("upload.submit")}
      </button>
    </section>
    </Tilt>
  );
}
