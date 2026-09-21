import { runTrendCheck } from "../agents/trendAgent";
import { findClusters, type TrendReport, type TrendStore } from "../tools/trendTools";

const now = Date.now();
const r = (id: string, lat: number, lng: number, disease: string, severity: string, daysAgo: number): TrendReport => ({
  id, lat, lng, disease, severity, alert: false, timestamp: new Date(now - daysAgo * 864e5).toISOString(),
});

const reports: TrendReport[] = [
  // Nashik-area black spot outbreak (4 reports within ~30 km, mixed severity)
  r("a1", 19.99, 73.79, "Black spot", "high", 0.2),
  r("a2", 20.05, 73.85, "black spot", "high", 1),
  r("a3", 19.93, 73.7, "Black spot", "medium", 2),
  r("a4", 20.1, 73.9, "Black spot", "medium", 3),
  // Same disease but far away (Punjab): must NOT join the Nashik cluster
  r("b1", 30.9, 75.85, "Black spot", "low", 1),
  // Only 2 rust reports nearby: below threshold
  r("c1", 18.52, 73.85, "Leaf rust", "medium", 1),
  r("c2", 18.55, 73.9, "Leaf rust", "medium", 2),
  // Ignored labels
  r("d1", 19.99, 73.79, "unclear", "low", 0.1),
  r("d2", 19.99, 73.79, "healthy", "low", 0.1),
];

const clusters = findClusters(reports);
console.log("clusters:", JSON.stringify(clusters.map((c) => ({ d: c.disease, n: c.count, ids: c.reportIds }))));
if (clusters.length !== 1 || clusters[0].count !== 4) throw new Error("clustering rule broken");
console.log("rule check OK\n");

const flagged: { ids: string[]; reason: string }[] = [];
const unflagged: string[][] = [];
// z9 was flagged earlier but its cluster no longer exists -> must be expired.
const stale = r("z9", 25.0, 80.0, "Leaf rust", "low", 20);
stale.alert = true;
const store: TrendStore = {
  recentReports: async () => reports,
  alertedReports: async () => [stale],
  flag: async (ids, reason) => (flagged.push({ ids, reason }), ids.length),
  unflag: async (ids) => (unflagged.push(ids), ids.length),
};

runTrendCheck(store).then((summary) => {
  console.log("agent summary:", summary);
  console.log("flag_alert calls:", JSON.stringify(flagged, null, 2));
  if (flagged.length !== 1 || flagged[0].ids.length !== 4) throw new Error("agent did not flag the outbreak correctly");
  if (unflagged.length !== 1 || unflagged[0][0] !== "z9") throw new Error("stale alert was not expired");
  console.log("agent check OK, stale alert expired");

  // Fallback: if the agent can't run (quota etc.), the rule must still flag the outbreak.
  flagged.length = 0;
  process.env.GOOGLE_API_KEY = "invalid-key-for-fallback-test";
  return runTrendCheck(store).then((s2) => {
    console.log("fallback summary:", s2);
    if (flagged.length !== 1 || flagged[0].ids.length !== 4) throw new Error("rule fallback did not flag");
    console.log("fallback check OK:", flagged[0].reason);
  });
});
