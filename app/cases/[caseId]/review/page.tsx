"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { StickyActionBar } from "@/components/sticky-action-bar";
import type { CaseRecord, ChecklistItem, MetricAssessment } from "@/lib/types/schema";

type ReviewPageProps = {
  params: {
    caseId: string;
  };
};

function createEmptyAssessment(): MetricAssessment {
  return {
    area_px: null,
    area_cm2: null,
    length_cm: null,
    width_cm: null,
    perimeter_cm: null,
    depth_cm: null,
    shape_regularity_score: null,
    tissue_composition: null,
    periwound_findings: [],
    exudate_estimate: null,
    image_quality_score: null,
    measurement_confidence: null,
    severity_score: null
  };
}

function parseOptionalNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export default function ReviewPage({ params }: ReviewPageProps) {
  const router = useRouter();
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [noteText, setNoteText] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [manualAssessment, setManualAssessment] = useState<MetricAssessment>(
    createEmptyAssessment()
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/cases/${params.caseId}`);
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to load encounter.");
        }

        const record: CaseRecord = payload.case_record;
        const encounter = record.encounter;

        setCaseRecord(record);
        setNoteText(
          encounter.review?.note_text ?? encounter.analysis?.structured_note.full_note ?? ""
        );
        setChecklist(
          encounter.review?.checklist ?? encounter.analysis?.prevention_checklist ?? []
        );
        setAcknowledged(encounter.review?.clinician_acknowledged ?? false);
        setManualAssessment(
          encounter.review?.clinician_wound_assessment ??
            encounter.analysis?.wound_metrics.clinician_entered ??
            createEmptyAssessment()
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load encounter.");
      }
    };

    void load();
  }, [params.caseId]);

  const handleChecklistChange = (index: number, patch: Partial<ChecklistItem>) => {
    setChecklist((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch
            }
          : item
      )
    );
  };

  const handleAssessmentChange = <K extends keyof MetricAssessment>(
    field: K,
    value: MetricAssessment[K]
  ) => {
    setManualAssessment((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleTissueChange = (
    field: "granulation" | "slough" | "eschar" | "epithelial",
    value: number | null
  ) => {
    setManualAssessment((current) => ({
      ...current,
      tissue_composition: {
        granulation: current.tissue_composition?.granulation ?? null,
        slough: current.tissue_composition?.slough ?? null,
        eschar: current.tissue_composition?.eschar ?? null,
        epithelial: current.tissue_composition?.epithelial ?? null,
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!acknowledged) {
      setError("Confirm clinician review before continuing to export.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/cases/${params.caseId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          note_text: noteText,
          checklist,
          clinician_acknowledged: acknowledged,
          clinician_wound_assessment: manualAssessment
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to save review.");
      }

      router.push(`/cases/${params.caseId}/export`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save review.");
    } finally {
      setSaving(false);
    }
  };

  if (!caseRecord?.encounter.analysis) {
    return (
      <AppShell
        title="Loading review"
        subtitle="Preparing the editable note and wound assessment."
        currentStep="review"
        backHref={`/cases/${params.caseId}/results`}
      >
        <div className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-card">
          {error || "Loading encounter review..."}
        </div>
      </AppShell>
    );
  }

  const { encounter, patient, wound } = caseRecord;
  const analysis = encounter.analysis!;
  const aiMetrics = analysis.wound_metrics.ai_estimated;

  return (
    <AppShell
      title="Clinician review"
      subtitle="Edit the draft note, confirm checklist items, and add clinician-entered wound values without overwriting AI estimates."
      currentStep="review"
      backHref={`/cases/${params.caseId}/results`}
      badge={analysis.meta.demo_mode ? <DemoModeBadge /> : undefined}
    >
      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Wound context
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          {patient.label} · {wound.label} · encounter {encounter.encounter_id}
        </p>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Capture calibration
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          {encounter.capture_context?.pixels_per_cm
            ? `Reference ${encounter.capture_context.reference_type.replace(/_/g, " ")} calibrated at ${encounter.capture_context.pixels_per_cm.toFixed(2)} px/cm.`
            : "No capture calibration was supplied for this encounter. AI centimeter values remain unavailable until a visible reference is entered."}
        </p>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Structured note draft
        </label>
        <textarea
          rows={12}
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          className="mt-3 w-full rounded-[24px] border border-ink/10 bg-mist px-4 py-4 text-sm leading-7 text-ink outline-none transition focus:border-teal"
        />
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          AI-estimated wound metrics
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            `Area (px): ${aiMetrics.area_px ?? "not available"}`,
            `Area (cm2): ${aiMetrics.area_cm2 ?? "not available"}`,
            `Length / width (cm): ${aiMetrics.length_cm ?? "n/a"} / ${aiMetrics.width_cm ?? "n/a"}`,
            `Perimeter (cm): ${aiMetrics.perimeter_cm ?? "not available"}`,
            `Shape regularity: ${aiMetrics.shape_regularity_score ?? "not available"}`,
            `Severity score: ${aiMetrics.severity_score ?? "not available"}`,
            `Image quality score: ${aiMetrics.image_quality_score ?? "not available"}`,
            `Measurement confidence: ${aiMetrics.measurement_confidence ?? "not available"}`,
            `Depth: ${analysis.wound_metrics.depth_guidance}`,
            `Periwound findings: ${
              aiMetrics.periwound_findings.length > 0
                ? aiMetrics.periwound_findings.join(", ")
                : "not available"
            }`,
            `Exudate estimate: ${aiMetrics.exudate_estimate ?? "not available"}`
          ].map((item) => (
            <div key={item} className="rounded-[22px] bg-mist px-4 py-3 text-sm text-ink/70">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Clinician-entered wound assessment
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          These fields are stored separately from the AI-estimated metrics so the wound timeline
          remains explicit about source provenance.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="rounded-[22px] bg-mist p-4">
            <span className="text-sm font-semibold text-ink">Area (cm2)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={stringifyNumber(manualAssessment.area_cm2)}
              onChange={(event) =>
                handleAssessmentChange("area_cm2", parseOptionalNumber(event.target.value))
              }
              className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            />
          </label>

          <label className="rounded-[22px] bg-mist p-4">
            <span className="text-sm font-semibold text-ink">Length (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={stringifyNumber(manualAssessment.length_cm)}
              onChange={(event) =>
                handleAssessmentChange("length_cm", parseOptionalNumber(event.target.value))
              }
              className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            />
          </label>

          <label className="rounded-[22px] bg-mist p-4">
            <span className="text-sm font-semibold text-ink">Width (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={stringifyNumber(manualAssessment.width_cm)}
              onChange={(event) =>
                handleAssessmentChange("width_cm", parseOptionalNumber(event.target.value))
              }
              className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            />
          </label>

          <label className="rounded-[22px] bg-mist p-4">
            <span className="text-sm font-semibold text-ink">Perimeter (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={stringifyNumber(manualAssessment.perimeter_cm)}
              onChange={(event) =>
                handleAssessmentChange("perimeter_cm", parseOptionalNumber(event.target.value))
              }
              className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            />
          </label>

          <label className="rounded-[22px] bg-mist p-4">
            <span className="text-sm font-semibold text-ink">Depth (cm)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={stringifyNumber(manualAssessment.depth_cm)}
              onChange={(event) =>
                handleAssessmentChange("depth_cm", parseOptionalNumber(event.target.value))
              }
              className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            />
          </label>

          <label className="rounded-[22px] bg-mist p-4">
            <span className="text-sm font-semibold text-ink">Shape regularity</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step="1"
              value={stringifyNumber(manualAssessment.shape_regularity_score)}
              onChange={(event) =>
                handleAssessmentChange(
                  "shape_regularity_score",
                  parseOptionalNumber(event.target.value)
                )
              }
              className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            />
          </label>

          <label className="rounded-[22px] bg-mist p-4">
            <span className="text-sm font-semibold text-ink">Severity score</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step="1"
              value={stringifyNumber(manualAssessment.severity_score)}
              onChange={(event) =>
                handleAssessmentChange("severity_score", parseOptionalNumber(event.target.value))
              }
              className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            />
          </label>

          <label className="rounded-[22px] bg-mist p-4">
            <span className="text-sm font-semibold text-ink">Exudate estimate</span>
            <input
              value={manualAssessment.exudate_estimate ?? ""}
              onChange={(event) =>
                handleAssessmentChange(
                  "exudate_estimate",
                  event.target.value.trim() === "" ? null : event.target.value
                )
              }
              placeholder="e.g. scant serous drainage"
              className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
            />
          </label>
        </div>

        <label className="mt-3 block rounded-[22px] bg-mist p-4">
          <span className="text-sm font-semibold text-ink">Periwound findings</span>
          <textarea
            rows={3}
            value={manualAssessment.periwound_findings.join(", ")}
            onChange={(event) =>
              handleAssessmentChange(
                "periwound_findings",
                event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
            placeholder="Comma-separated findings"
            className="mt-3 w-full rounded-[18px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
          />
        </label>

        <div className="mt-3 rounded-[22px] bg-mist p-4">
          <p className="text-sm font-semibold text-ink">Tissue composition (%)</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {[
              ["granulation", manualAssessment.tissue_composition?.granulation ?? null],
              ["slough", manualAssessment.tissue_composition?.slough ?? null],
              ["eschar", manualAssessment.tissue_composition?.eschar ?? null],
              ["epithelial", manualAssessment.tissue_composition?.epithelial ?? null]
            ].map(([label, value]) => (
              <label key={label} className="rounded-[18px] bg-white p-3">
                <span className="text-sm font-medium capitalize text-ink">{label}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step="1"
                  value={stringifyNumber(value as number | null)}
                  onChange={(event) =>
                    handleTissueChange(
                      label as "granulation" | "slough" | "eschar" | "epithelial",
                      parseOptionalNumber(event.target.value)
                    )
                  }
                  className="mt-2 w-full rounded-[14px] border border-ink/10 bg-mist px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Prevention checklist
        </p>
        <div className="mt-3 space-y-3">
          {checklist.map((item, index) => (
            <div key={item.id} className="rounded-[24px] bg-mist p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={(event) =>
                    handleChecklistChange(index, { selected: event.target.checked })
                  }
                  className="mt-1 h-4 w-4 accent-teal"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-ink/65">{item.description}</p>
                  <textarea
                    rows={2}
                    value={item.clinician_note}
                    onChange={(event) =>
                      handleChecklistChange(index, { clinician_note: event.target.value })
                    }
                    placeholder="Optional clinician note"
                    className="mt-3 w-full rounded-[20px] border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-teal"
                  />
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <label className="rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-card">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1 h-4 w-4 accent-teal"
          />
          <div>
            <p className="text-sm font-semibold text-ink">Clinician review acknowledgement</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              I have reviewed the draft note, current encounter metrics, and checklist before
              export.
            </p>
          </div>
        </div>
      </label>

      {error ? (
        <div className="rounded-[22px] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      ) : null}

      <StickyActionBar>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-[24px] bg-ink px-5 py-4 text-base font-semibold text-white shadow-float transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink/45"
        >
          {saving ? "Saving review..." : "Save and continue to export"}
        </button>
      </StickyActionBar>
    </AppShell>
  );
}
