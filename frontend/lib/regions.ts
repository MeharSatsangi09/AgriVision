// Coarse state/UT classification by nearest centroid — good enough to group reports into a
// "regional" view for the interoperability data page, NOT a precise administrative-boundary lookup
// (a report near a state border can be classified to the neighboring state). Documented as an
// approximation wherever this is shown. Centroids are standard reference values, kept short on
// purpose (a full boundary polygon set is unnecessary for a coarse regional rollup).
const STATE_CENTROIDS: [string, number, number][] = [
  ["Andhra Pradesh", 15.9, 79.7], ["Arunachal Pradesh", 28.2, 94.7], ["Assam", 26.2, 92.9],
  ["Bihar", 25.6, 85.1], ["Chhattisgarh", 21.3, 81.9], ["Goa", 15.3, 74.1], ["Gujarat", 22.6, 71.6],
  ["Haryana", 29.1, 76.1], ["Himachal Pradesh", 31.9, 77.2], ["Jharkhand", 23.6, 85.3],
  ["Karnataka", 15.3, 75.7], ["Kerala", 10.5, 76.3], ["Madhya Pradesh", 23.5, 78.0],
  ["Maharashtra", 19.5, 76.0], ["Manipur", 24.7, 93.9], ["Meghalaya", 25.5, 91.3],
  ["Mizoram", 23.2, 92.9], ["Nagaland", 26.2, 94.6], ["Odisha", 20.5, 84.7], ["Punjab", 31.0, 75.5],
  ["Rajasthan", 26.9, 73.8], ["Sikkim", 27.5, 88.5], ["Tamil Nadu", 10.9, 78.4],
  ["Telangana", 18.0, 79.3], ["Tripura", 23.8, 91.5], ["Uttar Pradesh", 26.8, 80.9],
  ["Uttarakhand", 30.1, 79.2], ["West Bengal", 23.5, 87.5],
  ["Delhi NCR", 28.6, 77.2], ["Jammu & Kashmir", 33.8, 76.6], ["Ladakh", 34.2, 77.6],
  ["Andaman & Nicobar", 11.7, 92.7], ["Lakshadweep", 10.3, 72.6],
];

// Nearest-centroid classification (equirectangular approximation — fine at this granularity).
export function nearestRegion(lat: number, lng: number): string {
  let best = STATE_CENTROIDS[0];
  let bestDist = Infinity;
  for (const c of STATE_CENTROIDS) {
    const dLat = lat - c[1];
    const dLng = (lng - c[2]) * Math.cos((lat * Math.PI) / 180);
    const d = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best[0];
}

export interface RegionalRow {
  region: string;
  totalReports: number;
  activeOutbreaks: number;
  byDisease: { disease: string; count: number }[];
}

// Shared aggregation used by both the public API route and the /data page, so they can never drift.
export function aggregateByRegion(
  reports: { lat: number; lng: number; alert?: boolean; diagnosis: { disease: string } }[]
): RegionalRow[] {
  const byRegion = new Map<string, { total: number; outbreaks: number; diseases: Map<string, number> }>();
  for (const r of reports) {
    const region = nearestRegion(r.lat, r.lng);
    const bucket = byRegion.get(region) ?? { total: 0, outbreaks: 0, diseases: new Map() };
    bucket.total++;
    if (r.alert) bucket.outbreaks++;
    // Fold case before grouping: most reports go through diagnosisAgent's normalizeDisease() (always
    // lower-case), but a few older/test-script reports predate that and stored mixed-case disease names —
    // without this, "Black Spot" / "Black spot" / "black spot" would each get their own row.
    const disease = r.diagnosis.disease.trim().toLowerCase();
    bucket.diseases.set(disease, (bucket.diseases.get(disease) ?? 0) + 1);
    byRegion.set(region, bucket);
  }
  return [...byRegion.entries()]
    .map(([region, b]) => ({
      region,
      totalReports: b.total,
      activeOutbreaks: b.outbreaks,
      byDisease: [...b.diseases.entries()]
        .map(([disease, count]) => ({ disease, count }))
        .sort((a, b2) => b2.count - a.count),
    }))
    .sort((a, b) => b.totalReports - a.totalReports);
}
