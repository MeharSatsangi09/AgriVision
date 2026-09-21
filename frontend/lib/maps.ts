let mapsPromise: Promise<void> | null = null;

// Loads the Google Maps JS API once, however many components ask for it.
export function loadMaps(): Promise<void> {
  return (mapsPromise ??= new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.google?.maps) return resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(s);
  }));
}

export const INDIA_CENTER = { lat: 22.5, lng: 79.5 };
export const INDIA_BOUNDS = { north: 37.5, south: 5.5, west: 67.5, east: 98.5 };

export const SEVERITY_COLOR = { low: "#3f9b4f", medium: "#d9922b", high: "#c8402f" } as const;
