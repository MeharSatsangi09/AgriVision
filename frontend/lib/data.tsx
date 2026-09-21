"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Report, UploadFailure } from "@/lib/types";

interface Data {
  reports: Report[]; // newest first
  failures: UploadFailure[];
  ready: boolean;
}

const Ctx = createContext<Data>({ reports: [], failures: [], ready: false });

// One realtime subscription per collection, shared by every page.
export function DataProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, "reports"),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Report);
        list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setReports(list);
        setReady(true);
      },
      () => setReady(true)
    );
    const u2 = onSnapshot(collection(db, "uploadErrors"), (snap) =>
      setFailures(snap.docs.map((d) => d.data() as UploadFailure))
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  const value = useMemo(() => ({ reports, failures, ready }), [reports, failures, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);

export interface Outbreak {
  key: string;
  disease: string;
  reports: Report[];
  high: number;
  latest: Report;
}

// Reports flagged together by the Trend/Alert Agent share the same alertReason.
export function groupOutbreaks(reports: Report[]): Outbreak[] {
  const map = new Map<string, Report[]>();
  reports
    .filter((r) => r.alert && r.alertReason)
    .forEach((r) => map.set(r.alertReason!, [...(map.get(r.alertReason!) ?? []), r]));
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      disease: list[0].diagnosis.disease,
      reports: list,
      high: list.filter((r) => r.diagnosis.severity === "high").length,
      latest: list[0], // reports are sorted newest-first
    }))
    .sort((a, b) => b.reports.length - a.reports.length);
}
