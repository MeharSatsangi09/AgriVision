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

export interface AuthToken {
  token: string;
  expiresAtMs: number; // absolute time (ms since epoch) the token stops working
}

// Keeps the Earth Engine client authenticated for the life of a (long-lived, minInstances=1) instance.
// The EE client silently drops its token once the token's lifetime passes and then sends requests with
// NO credential ("Request is missing required authentication credential"), so a token fetched once at
// startup stops working after ~1 hour. This manager re-mints the token whenever the client has none or
// the current one expires within REFRESH_BEFORE_MS. Dependencies are injected so it can be tested offline.
export const REFRESH_BEFORE_MS = 5 * 60_000;
export class EarthEngineAuth {
  private initialized = false;
  private expiresAtMs = 0;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly deps: {
      mintToken: () => Promise<AuthToken>;
      hasToken: () => boolean; // ground truth: does the EE client still hold a token?
      setToken: (t: AuthToken) => void;
      initialize: () => Promise<void>; // ee.initialize; run once, after the first token is set
      now?: () => number;
    }
  ) {}

  private now = () => (this.deps.now ?? Date.now)();

  private needsRefresh() {
    return !this.initialized || !this.deps.hasToken() || this.expiresAtMs - this.now() < REFRESH_BEFORE_MS;
  }

  // Resolves once the client holds a token valid for at least REFRESH_BEFORE_MS. Concurrent callers share
  // one refresh; a failed refresh is NOT cached, so the next lookup simply tries again.
  ensure(): Promise<void> {
    if (!this.needsRefresh()) return Promise.resolve();
    if (!this.pending) {
      this.pending = (async () => {
        const t = await this.deps.mintToken();
        this.deps.setToken(t);
        this.expiresAtMs = t.expiresAtMs;
        if (!this.initialized) {
          await this.deps.initialize();
          this.initialized = true;
        }
      })().finally(() => {
        this.pending = null;
      });
    }
    return this.pending;
  }
}

// Real wiring: the Cloud Function's own runtime service account via ADC (no downloaded private key) —
// ee.data.setAuthToken() accepts a pre-fetched OAuth2 token, which is Earth Engine's own documented pattern
// for serverless environments. Requires: the Cloud project registered with Earth Engine, the Earth Engine
// API enabled, and the service account granted the "Earth Engine Resource Viewer" IAM role — none of which
// this code can verify itself; a real failure here just means one of those isn't done yet, and
// getVegetationIndex() below treats that as "no satellite data" and moves on.
const googleAuth = new GoogleAuth({ scopes: EE_SCOPES });
const eeAuth = new EarthEngineAuth({
  mintToken: async () => {
    const client = await googleAuth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("no access token from ADC");
    const expiry = (client as { credentials?: { expiry_date?: number | null } }).credentials?.expiry_date;
    return { token, expiresAtMs: expiry ?? Date.now() + 55 * 60_000 };
  },
  hasToken: () => !!ee.data.getAuthToken(),
  setToken: ({ token, expiresAtMs }) => {
    const expiresInSec = Math.max(60, Math.floor((expiresAtMs - Date.now()) / 1000));
    ee.data.setAuthToken("", "Bearer", token, expiresInSec, [], undefined, false);
  },
  initialize: () =>
    new Promise<void>((resolve, reject) => {
      ee.initialize(null, null, () => resolve(), (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))), EE_PROJECT);
    }),
});

// MODIS Terra 16-day NDVI composite — coarse (250m) but global, free, no per-report cost beyond the
// Earth Engine call itself. NDVI composites lag real time by design (16-day windows, days to weeks of
// processing latency), so `date` is the composite's own date, not the upload date — shown as such on
// the report, not implied to be a live/real-time reading.
const DATASET = "MODIS/061/MOD13Q1";
const LOOKBACK_DAYS = 40; // wide enough to reliably catch at least one 16-day composite

export async function getVegetationIndex(lat: number, lng: number): Promise<SatelliteData | null> {
  try {
    await eeAuth.ensure();
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
