"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, Crosshair, MapPinned } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { inIndia } from "@/lib/india";
import { INDIA_BOUNDS, INDIA_CENTER, loadMaps } from "@/lib/maps";
import { roundCoord } from "@/lib/format";
import type { LatLng } from "@/lib/types";
import { cn } from "@/lib/utils";

// Field location: GPS button and/or click-on-map. Points outside India are rejected.
export default function LocationPicker({ value, onChange }: { value: LatLng | null; onChange: (l: LatLng) => void }) {
  const { t } = useI18n();
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const accept = useCallback(
    (l: LatLng) => {
      if (!inIndia(l.lat, l.lng)) return setMsg(t("loc.outside"));
      setMsg("");
      onChange(l);
    },
    [onChange, t]
  );

  const useGps = useCallback(() => {
    if (!navigator.geolocation) return setMsg(t("loc.denied"));
    setBusy(true);
    setMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false);
        accept({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        setBusy(false);
        setMsg(t("loc.denied"));
        setMapOpen(true);
      },
      { timeout: 10000 }
    );
  }, [accept, t]);

  // If the browser already has permission, fill the location in silently.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => s.state === "granted" && useGps())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold">{t("loc.title")}</h3>
        <button
          type="button"
          onClick={useGps}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        >
          <Crosshair className="size-4" /> {busy ? t("loc.detecting") : t("loc.use")}
        </button>
        <button
          type="button"
          onClick={() => setMapOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-muted",
            mapOpen && "bg-accent text-accent-foreground"
          )}
        >
          <MapPinned className="size-4" /> {t("loc.pick")}
        </button>
      </div>

      {value ? (
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <CircleCheck className="size-4" /> {t("loc.set")} · {roundCoord(value.lat)}°N, {roundCoord(value.lng)}°E
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("loc.needed")}</p>
      )}
      {msg && <p className="text-sm text-severity-high">{msg}</p>}

      {mapOpen && <PickMap value={value} onPick={accept} hint={t("loc.hint")} />}
    </div>
  );
}

function PickMap({ value, onPick, hint }: { value: LatLng | null; onPick: (l: LatLng) => void; hint: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const pin = useRef<google.maps.Marker | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let dead = false;
    loadMaps().then(() => {
      if (dead || !el.current) return;
      const m = new google.maps.Map(el.current, {
        center: value ?? INDIA_CENTER,
        zoom: value ? 9 : 4,
        minZoom: 4,
        restriction: { latLngBounds: INDIA_BOUNDS, strictBounds: false },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      m.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) pickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
      setMap(m);
    });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map || !value) return;
    pin.current?.setMap(null);
    pin.current = new google.maps.Marker({ map, position: value, title: "Field" });
    map.panTo(value);
  }, [map, value]);

  return (
    <div>
      <div ref={el} className="h-64 w-full rounded-xl border bg-muted" />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
