"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { LoadingPipeline } from "@/components/loading-pipeline";
import { getCaseDraft, saveCaseDraft } from "@/lib/client/case-draft";
import { demoCases } from "@/lib/demo/cases";

const stages = [
  "Image loaded",
  "ROI extracted",
  "Classifier run",
  "Wound metrics staged",
  "Checklist generated",
  "Note drafted"
];

type AnalysisPageProps = {
  params: {
    caseId: string;
  };
};

export default function AnalysisPage({ params }: AnalysisPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoCaseId = searchParams.get("demo");
  const startedRef = useRef(false);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [error, setError] = useState("");

  const demoCase = useMemo(
    () => (demoCaseId ? demoCases.find((item) => item.id === demoCaseId) : undefined),
    [demoCaseId]
  );

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const draft = getCaseDraft(params.caseId);
    const interval = window.setInterval(() => {
      setCompletedSteps((current) => Math.min(current + 1, stages.length - 1));
    }, 750);

    const run = async () => {
      try {
        if (demoCaseId) {
          saveCaseDraft(params.caseId, {
            demoCaseId
          });
        }

        if (!demoCaseId && !draft?.upload) {
          router.replace(`/cases/${params.caseId}/upload`);
          return;
        }

        if (!demoCaseId && !draft?.riskForm) {
          router.replace(`/cases/${params.caseId}/risk`);
          return;
        }

        const response = await fetch("/api/full-pipeline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            caseId: params.caseId,
            imagePath: draft?.upload?.file_path,
            captureContext: draft?.captureContext,
            riskForm: draft?.riskForm,
            demoCaseId
          })
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Pipeline failed.");
        }

        setCompletedSteps(stages.length);
        window.setTimeout(() => {
          router.replace(`/cases/${params.caseId}/results`);
        }, 900);
      } catch (pipelineError) {
        setError(
          pipelineError instanceof Error ? pipelineError.message : "Pipeline request failed."
        );
      } finally {
        window.clearInterval(interval);
      }
    };

    void run();

    return () => {
      window.clearInterval(interval);
    };
  }, [demoCaseId, params.caseId, router]);

  return (
    <AppShell
      title="Analyzing encounter"
      subtitle={
        demoCase
          ? `${demoCase.title}: ${demoCase.description}`
          : "Running image localization, wound metrics, concern scoring, prevention logic, and note drafting."
      }
      currentStep="analysis"
      backHref={demoCaseId ? "/" : `/cases/${params.caseId}/risk`}
      badge={demoCaseId ? <DemoModeBadge /> : undefined}
    >
      <LoadingPipeline completedSteps={completedSteps} stages={stages} />

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Safety framing
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          This analysis supports documentation and prevention planning only. Concern labels remain
          non-diagnostic and can return unable-to-determine when confidence is limited.
        </p>
      </div>

      {error ? (
        <div className="rounded-[24px] border border-coral/20 bg-coral/10 p-4 text-sm text-coral">
          <p className="font-semibold">Pipeline failed</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
