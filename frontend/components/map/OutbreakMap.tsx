"use client";
import { useEffect, useRef, useState } from "react";
import { INDIA_BOUNDS, INDIA_CENTER, SEVERITY_COLOR, loadMaps } from "@/lib/maps";
import type { Report } from "@/lib/types";
import { cn } from "@/lib/utils";

// Live map of reports. Flagged outbreaks get pulsing red hotspot rings.
export default function OutbreakMap({
  reports,
  selectedId,
  onSelect,
  className,
}: {
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const markers = useRef<google.maps.Marker[]>([]);
  const rings = useRef<google.maps.Circle[]>([]);
  const fitted = useRef(false);
  const markersDropped = useRef(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    let dead = false;
    loadMaps()
      .then(() => {
        if (dead || !el.current) return;
        setMap(
          new google.maps.Map(el.current, {
            center: INDIA_CENTER,
            zoom: 5,
            minZoom: 4,
            restriction: { latLngBounds: INDIA_BOUNDS, strictBounds: false },
            mapTypeControl: false,
            streetViewControl: false,
            clickableIcons: false,
          })
        );
      })
      .catch(() => setFailed(true));
    return () => {
      dead = true;
    };
  }, []);

  // Markers. A DROP animation plays once, the first time markers populate the map — not on every
  // re-selection (the effect re-runs on selectedId changes too, and re-dropping on every click would be noisy).
  useEffect(() => {
    if (!map) return;
    const dropIn = !markersDropped.current && reports.length > 0;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = reports.map((r, i) => {
      const selected = r.id === selectedId;
      const m = new google.maps.Marker({
        map,
        position: { lat: r.lat, lng: r.lng },
        title: r.diagnosis.disease,
        zIndex: selected ? 100 : r.alert ? 50 : 1,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: selected ? 12 : 9,
          fillColor: SEVERITY_COLOR[r.diagnosis.severity],
          fillOpacity: 0.95,
          strokeColor: selected ? "#111" : "#fff",
          strokeWeight: selected ? 3 : 2,
        },
      });
      if (dropIn) {
        // Stagger the drops slightly instead of every marker landing in unison; DROP self-clears after ~700ms.
        const delay = Math.min(i, 12) * 40;
        setTimeout(() => m.setAnimation(google.maps.Animation.DROP), delay);
        setTimeout(() => m.setAnimation(null), delay + 700);
      }
      m.addListener("click", () => selectRef.current(r.id));
      return m;
    });
    if (dropIn) markersDropped.current = true;
  }, [map, reports, selectedId]);

  // Fit the view to the data once, when it first arrives.
  useEffect(() => {
    if (!map || fitted.current || !reports.length) return;
    fitted.current = true;
    const b = new google.maps.LatLngBounds();
    reports.forEach((r) => b.extend({ lat: r.lat, lng: r.lng }));
    map.fitBounds(b, 60);
    google.maps.event.addListenerOnce(map, "idle", () => (map.getZoom() ?? 5) > 9 && map.setZoom(9));
  }, [map, reports]);

  // Pulsing hotspot rings
  useEffect(() => {
    if (!map) return;
    rings.current.forEach((c) => c.setMap(null));
    rings.current = reports
      .filter((r) => r.alert)
      .map(
        (r) =>
          new google.maps.Circle({
            map,
            center: { lat: r.lat, lng: r.lng },
            radius: 25_000,
            strokeColor: SEVERITY_COLOR.high,
            strokeOpacity: 0.6,
            strokeWeight: 1,
            fillColor: SEVERITY_COLOR.high,
            fillOpacity: 0.16,
            clickable: false,
          })
      );
    if (!rings.current.length) return;
    let t = 0;
    const id = setInterval(() => {
      t += 0.12;
      const k = (Math.sin(t) + 1) / 2;
      rings.current.forEach((c) => c.setOptions({ radius: 20_000 + k * 15_000, fillOpacity: 0.22 - k * 0.12 }));
    }, 60);
    return () => clearInterval(id);
  }, [map, reports]);

  // Focus the selected report
  useEffect(() => {
    const r = reports.find((x) => x.id === selectedId);
    if (map && r) {
      map.panTo({ lat: r.lat, lng: r.lng });
      if ((map.getZoom() ?? 5) < 8) map.setZoom(8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedId]);

  return (
    <div data-lenis-prevent className={cn("relative overflow-hidden rounded-2xl border bg-muted shadow-sm", className)}>
      <div ref={el} className="absolute inset-0" />
      {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">Map unavailable</p>}
    </div>
  );
}
