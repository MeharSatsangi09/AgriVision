"use client";
import { useMemo, useState } from "react";
import { Database, TriangleAlert } from "lucide-react";
import { useData } from "@/lib/data";
import { aggregateByRegion } from "@/lib/regions";
import { titleCase } from "@/lib/format";

// Public, documented, read-only view of aggregated regional crop-disease data — the "shareable,
// interoperable agri-data layer" concept from prd.md. No new backend infra: reframes data that is
// already public-read in Firestore (firestore.rules) and already streamed to the map/alerts pages,
// grouped by region instead of plotted as points. Same data is available as JSON at /api/regional-data
// for other systems (state agriculture departments, other apps) to consume without talking to
// Firestore directly. English-only by design — this page targets extension officers/policymakers and
// external systems (prd.md's second target user group), not the farmer-facing localized UI.
export default function RegionalDataView() {
  const { reports, ready } = useData();
  const rows = useMemo(() => aggregateByRegion(reports), [reports]);
  const [copied, setCopied] = useState(false);

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/api/regional-data`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Database className="size-7 text-primary" /> Regional Data
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A public, read-only view of AgriVision&apos;s aggregated crop-disease reports, grouped by region —
          the shared, interoperable agri-data layer described in the project brief. Built entirely from data
          that is already public in Firestore (no farmer identity, no exact location — coordinates are
          rounded to ~1&nbsp;km); this page and the API below just reframe it for state agriculture
          departments, researchers, or other apps to consume.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">Machine-readable endpoint</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Same data as JSON, updated live, no API key required:
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-muted px-3 py-1.5 text-sm">/api/regional-data</code>
          <button
            onClick={copyEndpoint}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
          >
            {copied ? "Copied" : "Copy full URL"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Returns <code>{"{ generatedAt, totalReports, regionClassification, regions: [{ region, totalReports, activeOutbreaks, byDisease }] }"}</code>.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-severity-medium/10 p-3 text-sm text-severity-medium">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <span>
          Regions are assigned by nearest state/UT centroid, not administrative boundaries — a report near
          a state border can be classified to the neighboring state. Treat counts as directional, not exact.
        </span>
      </p>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Region</th>
              <th className="px-4 py-3 font-semibold">Reports</th>
              <th className="px-4 py-3 font-semibold">Active outbreaks</th>
              <th className="px-4 py-3 font-semibold">Top diseases</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {ready ? "No reports yet." : "…"}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.region} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{r.region}</td>
                <td className="px-4 py-3">{r.totalReports}</td>
                <td className="px-4 py-3">
                  {r.activeOutbreaks > 0 ? (
                    <span className="rounded-full bg-severity-high/15 px-2 py-0.5 text-xs font-medium text-severity-high">
                      {r.activeOutbreaks}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.byDisease
                    .slice(0, 3)
                    .map((d) => `${titleCase(d.disease)} (${d.count})`)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
