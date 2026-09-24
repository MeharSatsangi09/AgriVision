import { GoogleAuth } from "google-auth-library";
// No TypeScript types are shipped for @google/earthengine; its API is also callback-heavy rather than
// Promise-based, so it's used loosely-typed here rather than fighting both.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ee: any = require("@google/earthengine");

export interface SatelliteData {
  ndvi: number; // -1..1, scaled from MODIS's stored 0.0001 factor
  date: string; // ISO date of the underlying satellite composite (not "now" — see note below)
  source: string;
}

const EE_PROJECT = process.env.GCLOUD_PROJECT || "agrivision-768d1";
const EE_SCOPES = ["https://www.googleapis.com/auth/earthengine.readonly", "https://www.googleapis.com/auth/cloud-platform"];

let initialized: Promise<void> | null = null;

// Authenticates using the Cloud Function's own runtime service account via ADC (no downloaded private
// key file) — ee.data.setAuthToken() accepts a pre-fetched OAuth2 token, which is Earth Engine's own
// documented pattern for serverless environments. Requires: the Cloud project registered with Earth
// Engine, the Earth Engine API enabled, and the service account granted the "Earth Engine Resource
// Viewer" IAM role — none of which this code can verify itself; a real failure here just means one of
// those isn't done yet, and getVegetationIndex() below treats that as "no satellite data" and moves on.
function initEarthEngine(): Promise<void> {
  if (!initialized) {
    initialized = (async () => {
      const auth = new GoogleAuth({ scopes: EE_SCOPES });
      const client = await auth.getClient();
      const { token } = await client.getAccessToken();
      if (!token) throw new Error("no access token from ADC");
      await new Promise<void>((resolve, reject) => {
        ee.data.setAuthToken("", "Bearer", token, 3600, [], undefined, false);
        ee.initialize(
          null,
          null,
          () => resolve(),
          (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
          EE_PROJECT
        );
      });
    })();
  }
  return initialized;
}

// MODIS Terra 16-day NDVI composite — coarse (250m) but global, free, no per-report cost beyond the
// Earth Engine call itself. NDVI composites lag real time by design (16-day windows, days to weeks of
// processing latency), so `date` is the composite's own date, not the upload date — shown as such on
// the report, not implied to be a live/real-time reading.
const DATASET = "MODIS/061/MOD13Q1";
const LOOKBACK_DAYS = 40; // wide enough to reliably catch at least one 16-day composite

export async function getVegetationIndex(lat: number, lng: number): Promise<SatelliteData | null> {
  try {
    await initEarthEngine();
    const end = new Date();
    const start = new Date(end.getTime() - LOOKBACK_DAYS * 86_400_000);
    const point = ee.Geometry.Point([lng, lat]);
    const image = ee.ImageCollection(DATASET)
      .filterDate(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10))
      .select("NDVI")
      .sort("system:time_start", false)
      .first();
    const result: { ndvi: number | null; date: string | null } = await new Promise((resolve, reject) => {
      ee.Dictionary({
        ndvi: image.reduceRegion({ reducer: ee.Reducer.first(), geometry: point, scale: 250 }).get("NDVI"),
        date: image.date().format("YYYY-MM-dd"),
      }).evaluate((value: any, err: unknown) => (err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve(value)));
    });
    if (result.ndvi == null || result.date == null) return null; // e.g. no composite in range (ocean/gap), not an error
    return { ndvi: Math.round(result.ndvi * 0.0001 * 1000) / 1000, date: result.date, source: DATASET };
  } catch (err) {
    console.warn("earth engine vegetation index failed:", err);
    return null; // never blocks the report — same contract as classifierTool.ts
  }
}
