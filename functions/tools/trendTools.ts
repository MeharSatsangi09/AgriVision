import { FunctionTool } from "@google/adk";
import { z } from "zod";

// Outbreak rule: MIN_REPORTS of the same disease within RADIUS_KM inside WINDOW_DAYS.
export const RADIUS_KM = 50;
export const WINDOW_DAYS = 7;
export const MIN_REPORTS = 3;

export interface TrendReport {
  id: string;
  lat: number;
  lng: number;
  timestamp: string;
  disease: string;
  severity: string;
  alert: boolean;
}

export interface Cluster {
  disease: string;
  count: number;
  reportIds: string[];
  centerLat: number;
  centerLng: number;
  severities: Record<string, number>;
  newestReportAt: string;
  alreadyAlerted: boolean;
}

// Storage abstraction so the agent can be tested without Firestore.
export interface TrendStore {
  recentReports(sinceIso: string): Promise<TrendReport[]>;
  alertedReports(): Promise<TrendReport[]>;
  flag(ids: string[], reason: string): Promise<number>;
  unflag(ids: string[]): Promise<number>;
}

const IGNORED = new Set(["healthy", "unclear", ""]);

export function clusterReason(c: Cluster): string {
  const high = c.severities.high ?? 0;
  const sev = high >= c.count / 2 ? "high-severity " : "";
  return `${c.count} ${sev}reports of ${c.disease} within ${RADIUS_KM} km in the last ${WINDOW_DAYS} days`;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// Deterministic geo-clustering: for each disease, greedily group reports within RADIUS_KM of a seed.
export function findClusters(reports: TrendReport[], minReports = MIN_REPORTS, radiusKm = RADIUS_KM): Cluster[] {
  const byDisease = new Map<string, TrendReport[]>();
  for (const r of reports) {
    const d = r.disease.trim().toLowerCase();
    if (IGNORED.has(d) || (r.lat === 0 && r.lng === 0)) continue;
    byDisease.set(d, [...(byDisease.get(d) ?? []), r]);
  }
  const clusters: Cluster[] = [];
  for (const [disease, list] of byDisease) {
    const used = new Set<string>();
    for (const seed of list) {
      if (used.has(seed.id)) continue;
      const members = list.filter((r) => !used.has(r.id) && haversineKm(seed.lat, seed.lng, r.lat, r.lng) <= radiusKm);
      if (members.length < minReports) continue;
      members.forEach((m) => used.add(m.id));
      const severities: Record<string, number> = {};
      members.forEach((m) => (severities[m.severity] = (severities[m.severity] ?? 0) + 1));
      clusters.push({
        disease,
        count: members.length,
        reportIds: members.map((m) => m.id),
        centerLat: members.reduce((s, m) => s + m.lat, 0) / members.length,
        centerLng: members.reduce((s, m) => s + m.lng, 0) / members.length,
        severities,
        newestReportAt: members.map((m) => m.timestamp).sort().at(-1)!,
        alreadyAlerted: members.every((m) => m.alert),
      });
    }
  }
  return clusters;
}

export function createTrendTools(store: TrendStore) {
  const findOutbreakCandidates = new FunctionTool({
    name: "find_outbreak_candidates",
    description: `Returns clusters of at least ${MIN_REPORTS} same-disease reports within ${RADIUS_KM} km of each other in the last ${WINDOW_DAYS} days. Each cluster has counts, severity mix, centre and report ids.`,
    parameters: z.object({}),
    execute: async () => {
      const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
      const clusters = findClusters(await store.recentReports(since));
      return { windowDays: WINDOW_DAYS, radiusKm: RADIUS_KM, clusters };
    },
  });

  const flagAlert = new FunctionTool({
    name: "flag_alert",
    description: "Marks the given reports as part of a confirmed regional outbreak so the map highlights them.",
    parameters: z.object({
      reportIds: z.array(z.string()),
      reason: z.string().describe("One short sentence for farmers/officers, e.g. '4 reports of black spot within 50 km in 7 days'."),
    }),
    execute: async ({ reportIds, reason }) => ({ flagged: await store.flag(reportIds, reason) }),
  });

  return { findOutbreakCandidates, flagAlert };
}
