"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Lightbulb, ScanSearch, X } from "lucide-react";
import LocationPicker from "@/components/diagnose/LocationPicker";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const [location, setLocation] = useState<LatLng | null>(null);
  const [drag, setDrag] = useState(false);
  const pickInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | null | undefined) {
    setProblem("");
    if (!f) return;
    if (!f.type.startsWith("image/")) return setProblem(t("err.notImage"));
    // Photos are compressed before upload, so only reject truly huge originals.
    if (f.size > MAX_BYTES * 5) return setProblem(t("err.tooBig"));
    setFile(f);
  }

  const ready = !!file && !!location;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-lg font-semibold">{t("upload.title")}</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Photo */}
        <div>
          <div
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "relative grid min-h-60 place-items-center overflow-hidden rounded-xl border-2 border-dashed p-4 text-center transition",
              drag ? "border-primary bg-accent" : "border-border bg-background"
            )}
          >
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="max-h-64 rounded-lg object-contain" />
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label={t("upload.change")}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-foreground/70 text-white transition hover:bg-foreground"
                >
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <ImagePlus className="mx-auto size-10 text-primary/70" />
                <p className="text-sm text-muted-foreground">{t("upload.drop")}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => pickInput.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-80"
                  >
                    <ImagePlus className="size-4" /> {t("upload.choose")}
                  </button>
                  <button
                    type="button"
                    onClick={() => camInput.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted"
                  >
                    <Camera className="size-4" /> {t("upload.camera")}
                  </button>
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
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" /> {t("upload.tip")}
          </p>
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
  );
}
