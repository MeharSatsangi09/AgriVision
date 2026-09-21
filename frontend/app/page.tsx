"use client";
import UploadCard from "@/components/diagnose/UploadCard";
import ProcessingSteps from "@/components/diagnose/ProcessingSteps";
import { useDiagnose } from "@/components/diagnose/useDiagnose";
import ResultPanel from "@/components/report/ResultPanel";
import { AlertStrip, Hero, HowItWorks, Stats } from "@/components/home/Sections";

// Diagnose page: upload -> processing -> result. Everything else lives on its own page.
export default function DiagnosePage() {
  const { phase, report, error, submit, reset } = useDiagnose();

  return (
    <div className="space-y-10">
      {(phase === "idle" || phase === "error") && <Hero />}

      {phase === "done" && report ? (
        <ResultPanel report={report} onAnother={reset} />
      ) : phase === "uploading" || phase === "analyzing" ? (
        <ProcessingSteps phase={phase} />
      ) : (
        <UploadCard error={error} onSubmit={submit} />
      )}

      {phase !== "analyzing" && phase !== "uploading" && (
        <>
          <AlertStrip />
          <Stats />
          <HowItWorks />
        </>
      )}
    </div>
  );
}
