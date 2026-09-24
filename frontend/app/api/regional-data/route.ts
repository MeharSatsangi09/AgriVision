import { NextResponse } from "next/server";

// Must be dynamic — this reads Firestore live on every request. Without this, Next.js would
// prerender it once at build time (no dynamic APIs used) and freeze the "live" data forever.
export const dynamic = "force-dynamic";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { aggregateByRegion } from "@/lib/regions";
import type { Report } from "@/lib/types";

// Public, read-only, documented endpoint for AgriVision's aggregated regional crop-disease data —
// the "shareable agri-data layer" concept from prd.md. Reframes data that is already public-read in
// Firestore (see firestore.rules) into a stable, structured JSON shape for outside consumers
// (state agriculture departments, other apps) instead of requiring them to talk to Firestore directly.
// No new backend infra: this is a Next.js Route Handler on the existing frontend deploy, reading the
// same public `reports` collection the map/alerts pages already read client-side.
//
// Response shape:
// {
//   generatedAt: ISO string,
//   totalReports: number,
//   regionClassification: "nearest-centroid approximation, not administrative boundaries",
//   regions: [{ region, totalReports, activeOutbreaks, byDisease: [{ disease, count }] }]
// }
export async function GET() {
  const snap = await getDocs(collection(db, "reports"));
  const reports = snap.docs.map((d) => d.data() as Report);
  const regions = aggregateByRegion(reports);
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      totalReports: reports.length,
      regionClassification: "nearest-centroid approximation, not administrative boundaries — see /data for details",
      regions,
    },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
