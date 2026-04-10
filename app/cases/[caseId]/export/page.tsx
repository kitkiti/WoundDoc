"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ClipboardButton } from "@/components/clipboard-button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { clearCaseDraft } from "@/lib/client/case-draft";
import type { CaseRecord } from "@/lib/types/schema";
import { formatTimestamp } from "@/lib/utils";

type ExportPageProps = {
  params: {
    caseId: string;
  };
};

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage({ params }: ExportPageProps) {
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/cases/${params.caseId}`);
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to load export.");
        }

        setCaseRecord(payload.case_record);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load export.");
      }
    };

    void load();
  }, [params.caseId]);

  const noteText = useMemo(() => {
    if (!caseRecord?.encounter.analysis) {
      return "";
    }

    return (
      caseRecord.encounter.review?.note_text ??
      caseRecord.encounter.analysis.structured_note.full_note
    );
  }, [caseRecord]);

  const exportJson = useMemo(() => {
    if (!caseRecord?.encounter.analysis) {
      return "";
    }

    return JSON.stringify(
      {
        patient: caseRecord.patient,
        wound: caseRecord.wound,
        timeline: caseRecord.timeline,
        encounter: {
          ...caseRecord.encounter,
          analysis: caseRecord.encounter.analysis,
          review: caseRecord.encounter.review
        }
      },
      null,
      2
    );
  }, [caseRecord]);

  if (error) {
    return (
      <AppShell
        title="Export unavailable"
        subtitle="The wound encounter export could not be loaded."
        currentStep="export"
        backHref={`/cases/${params.caseId}/review`}
      >
        <div className="rounded-[24px] border border-coral/20 bg-coral/10 p-4 text-sm text-coral">
          {error}
        </div>
      </AppShell>
    );
  }

  if (!caseRecord?.encounter.analysis) {
    return (
      <AppShell
        title="Preparing export"
        subtitle="Loading the reviewed note and longitudinal JSON payload."
        currentStep="export"
        backHref={`/cases/${params.caseId}/review`}
      >
        <div className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-card">
          Loading export output...
        </div>
      </AppShell>
    );
  }

  const { encounter, patient, wound } = caseRecord;
  const analysis = encounter.analysis;

  return (
    <AppShell
      title="Export outputs"
      subtitle="Copy or download the reviewed note plus the structured patient, wound, and encounter payload."
      currentStep="export"
      backHref={`/cases/${params.caseId}/review`}
      badge={analysis?.meta.demo_mode ? <DemoModeBadge /> : undefined}
    >
      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          WoundWatch session
        </p>
        <p className="mt-2 text-sm text-ink/70">Patient: {patient.label}</p>
        <p className="mt-1 text-sm text-ink/70">Wound: {wound.label}</p>
        <p className="mt-1 text-sm text-ink/70">Encounter: {encounter.encounter_id}</p>
        <p className="mt-1 text-sm text-ink/70">Model: {analysis?.meta.model_name}</p>
        <p className="mt-1 text-sm text-ink/70">
          Generated: {analysis ? formatTimestamp(analysis.meta.timestamp) : "Not available"}
        </p>
        <p className="mt-1 text-sm text-ink/70">
          Demo mode: {analysis?.meta.demo_mode ? "Enabled" : "Off"}
        </p>
        {encounter.export_paths ? (
          <>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              Saved locally
            </p>
            <p className="mt-2 break-all text-sm text-ink/70">
              JSON: {encounter.export_paths.json_path}
            </p>
            <p className="mt-1 break-all text-sm text-ink/70">
              Note: {encounter.export_paths.note_path}
            </p>
          </>
        ) : null}
      </div>

      <div className="grid gap-3">
        <ClipboardButton text={noteText} label="Copy note text" />
        <ClipboardButton text={exportJson} label="Copy JSON" />
        <button
          type="button"
          onClick={() => downloadText(`woundwatch-${params.caseId}.txt`, noteText, "text/plain")}
          className="rounded-[22px] border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card"
        >
          Download note text
        </button>
        <button
          type="button"
          onClick={() =>
            downloadText(`woundwatch-${params.caseId}.json`, exportJson, "application/json")
          }
          className="rounded-[22px] border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card"
        >
          Download structured JSON
        </button>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Note preview
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-[24px] bg-mist p-4 text-sm leading-7 text-ink/80">
          {noteText}
        </pre>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">JSON preview</p>
        <pre className="mt-3 max-h-[360px] overflow-auto rounded-[24px] bg-mist p-4 text-xs leading-6 text-ink/80">
          {exportJson}
        </pre>
      </div>

      <Link
        href="/"
        onClick={() => clearCaseDraft(params.caseId)}
        className="inline-flex items-center justify-center rounded-[24px] bg-ink px-5 py-4 text-base font-semibold text-white shadow-float transition hover:bg-teal"
      >
        Start another encounter
      </Link>
    </AppShell>
  );
}
