"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { ProbabilityMeter } from "@/components/probability-meter";
import { StickyActionBar } from "@/components/sticky-action-bar";
import type { CaseRecord, TissueComposition } from "@/lib/types/schema";
import { cn, formatTimestamp, round, toPercent } from "@/lib/utils";

type ResultsPageProps = {
  params: {
    caseId: string;
  };
};

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatBBox(bbox: [number, number, number, number] | null | undefined) {
  if (!bbox) {
    return "Not available";
  }

  return bbox.join(", ");
}

function formatMetricValue(
  value: number | null | undefined,
  options?: { suffix?: string; precision?: number }
) {
  if (value === null || value === undefined) {
    return "Not entered";
  }

  const suffix = options?.suffix ?? "";
  const precision = options?.precision ?? 1;
  return `${round(value, precision)}${suffix}`;
}

function formatTextValue(value: string | null | undefined) {
  return value?.trim() ? value : "Not entered";
}

function formatList(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return "Not entered";
  }

  return values.join(", ");
}

function formatTissueComposition(value: TissueComposition | null | undefined) {
  if (!value) {
    return "Not entered";
  }

  const entries = Object.entries(value).filter(
    (_entry): _entry is [string, number] => typeof _entry[1] === "number"
  );

  if (entries.length === 0) {
    return "Not entered";
  }

  return entries
    .map(([label, amount]) => `${formatLabel(label)} ${round(amount, 0)}%`)
    .join(", ");
}

function formatProgressionLabel(value: "improving" | "stable" | "worsening" | "insufficient_data") {
  if (value === "insufficient_data") {
    return "Not enough data";
  }

  return value.replace(/_/g, " ");
}

export default function ResultsPage({ params }: ResultsPageProps) {
  const router = useRouter();
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/cases/${params.caseId}`);
        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to load encounter.");
        }

        setCaseRecord(payload.case_record);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load encounter.");
      }
    };

    void load();
  }, [params.caseId]);

  const metricCards = useMemo(() => {
    const analysis = caseRecord?.encounter.analysis;

    if (!analysis) {
      return [];
    }

    return [
      {
        label: "Area (px)",
        ai: formatMetricValue(analysis.wound_metrics.ai_estimated.area_px, { precision: 0 }),
        clinician: formatMetricValue(analysis.wound_metrics.clinician_entered.area_px, {
          precision: 0
        }),
        detail: "Pixel area is the only size estimate currently derived without calibration."
      },
      {
        label: "Area (cm2)",
        ai: formatMetricValue(analysis.wound_metrics.ai_estimated.area_cm2, { suffix: " cm2" }),
        clinician: formatMetricValue(analysis.wound_metrics.clinician_entered.area_cm2, {
          suffix: " cm2"
        }),
        detail: "Populates from the wound mask when capture calibration is available, otherwise manual entry stays primary."
      },
      {
        label: "Length / Width",
        ai: `${formatMetricValue(analysis.wound_metrics.ai_estimated.length_cm, {
          suffix: " cm"
        })} / ${formatMetricValue(analysis.wound_metrics.ai_estimated.width_cm, {
          suffix: " cm"
        })}`,
        clinician: `${formatMetricValue(analysis.wound_metrics.clinician_entered.length_cm, {
          suffix: " cm"
        })} / ${formatMetricValue(analysis.wound_metrics.clinician_entered.width_cm, {
          suffix: " cm"
        })}`,
        detail: "Longest axis and widest perpendicular width are derived from the segmentation mask when calibrated."
      },
      {
        label: "Perimeter",
        ai: formatMetricValue(analysis.wound_metrics.ai_estimated.perimeter_cm, {
          suffix: " cm"
        }),
        clinician: formatMetricValue(analysis.wound_metrics.clinician_entered.perimeter_cm, {
          suffix: " cm"
        }),
        detail: "Perimeter is derived from the wound mask when capture calibration is available."
      },
      {
        label: "Depth",
        ai: "Not inferable from a single 2D photo",
        clinician: formatMetricValue(analysis.wound_metrics.clinician_entered.depth_cm, {
          suffix: " cm"
        }),
        detail: analysis.wound_metrics.depth_guidance
      },
      {
        label: "Shape regularity",
        ai: formatMetricValue(analysis.wound_metrics.ai_estimated.shape_regularity_score, {
          precision: 0
        }),
        clinician: formatMetricValue(
          analysis.wound_metrics.clinician_entered.shape_regularity_score,
          {
            precision: 0
          }
        ),
        detail: "Contour regularity comes from the segmentation mask rather than the bbox outline."
      },
      {
        label: "Severity score",
        ai: formatMetricValue(analysis.wound_metrics.ai_estimated.severity_score, {
          precision: 0
        }),
        clinician: formatMetricValue(analysis.wound_metrics.clinician_entered.severity_score, {
          precision: 0
        }),
        detail: "Structured severity is reviewable and can be overridden by the clinician."
      },
      {
        label: "Image quality / confidence",
        ai: `${formatMetricValue(analysis.wound_metrics.ai_estimated.image_quality_score, {
          precision: 0
        })} / ${formatTextValue(analysis.wound_metrics.ai_estimated.measurement_confidence)}`,
        clinician: `${formatMetricValue(
          analysis.wound_metrics.clinician_entered.image_quality_score,
          {
            precision: 0
          }
        )} / ${formatTextValue(
          analysis.wound_metrics.clinician_entered.measurement_confidence
        )}`,
        detail: "Confidence drops when ROI quality flags make longitudinal comparisons less reliable."
      },
      {
        label: "Periwound findings",
        ai: formatList(analysis.wound_metrics.ai_estimated.periwound_findings),
        clinician: formatList(analysis.wound_metrics.clinician_entered.periwound_findings),
        detail: "AI-derived context stays separate from bedside observations."
      },
      {
        label: "Exudate estimate",
        ai: formatTextValue(analysis.wound_metrics.ai_estimated.exudate_estimate),
        clinician: formatTextValue(analysis.wound_metrics.clinician_entered.exudate_estimate),
        detail: "Manual confirmation is expected before exudate language is finalized."
      },
      {
        label: "Tissue composition",
        ai: formatTissueComposition(analysis.wound_metrics.ai_estimated.tissue_composition),
        clinician: formatTissueComposition(
          analysis.wound_metrics.clinician_entered.tissue_composition
        ),
        detail: "Tissue mix is scaffolded in the schema now and can be filled manually today."
      }
    ];
  }, [caseRecord]);

  if (error) {
    return (
      <AppShell
        title="Results unavailable"
        subtitle="The encounter output could not be loaded."
        currentStep="results"
        backHref={`/cases/${params.caseId}/analysis`}
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
        title="Loading results"
        subtitle="Waiting for the saved wound encounter output."
        currentStep="results"
        backHref={`/cases/${params.caseId}/analysis`}
      >
        <div className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-card">
          Loading encounter output...
        </div>
      </AppShell>
    );
  }

  const { encounter, patient, timeline, wound, progression } = caseRecord;
  const analysis = encounter.analysis!;
  const upload = encounter.upload;

  return (
    <AppShell
      title="Encounter summary"
      subtitle="Review the current encounter, provisional wound metrics, and the split between AI-estimated versus clinician-entered values."
      currentStep="results"
      backHref={`/cases/${params.caseId}/analysis`}
      badge={analysis.meta.demo_mode ? <DemoModeBadge /> : undefined}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            label: "Patient",
            value: patient.label,
            detail: patient.patient_id
          },
          {
            label: "Tracked wound",
            value: wound.label,
            detail: wound.body_site ?? "Body site pending"
          },
          {
            label: "Wound timeline",
            value: `${timeline.length} encounter${timeline.length === 1 ? "" : "s"}`,
            detail: `Current encounter ${formatTimestamp(encounter.created_at)}`
          },
          {
            label: "Encounter",
            value: encounter.encounter_id,
            detail: `Updated ${formatTimestamp(encounter.updated_at)}`
          }
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[26px] border border-white/70 bg-white/82 p-4 shadow-card"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              {item.label}
            </p>
            <p className="mt-2 text-base font-semibold text-ink">{item.value}</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Wound progression</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
              progression.status === "improving"
                ? "bg-emerald-100 text-emerald-700"
                : progression.status === "worsening"
                  ? "bg-rose-100 text-rose-700"
                  : progression.status === "stable"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-slate-200 text-slate-700"
            )}
          >
            {formatProgressionLabel(progression.status)}
          </span>
          {progression.compared_encounter_id ? (
            <span className="text-xs text-ink/60">Compared to encounter {progression.compared_encounter_id}</span>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-ink/70">{progression.summary}</p>
        {progression.evaluated_metrics.length > 0 ? (
          <p className="mt-2 text-xs text-ink/60">
            Metrics compared: {progression.evaluated_metrics.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Capture calibration
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-[22px] bg-mist px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
              Reference
            </p>
            <p className="mt-2 text-sm text-ink">
              {encounter.capture_context?.reference_visible
                ? formatLabel(encounter.capture_context.reference_type)
                : "No reference entered"}
            </p>
          </div>
          <div className="rounded-[22px] bg-mist px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
              Calibration status
            </p>
            <p className="mt-2 text-sm text-ink">
              {encounter.capture_context?.pixels_per_cm
                ? `${round(encounter.capture_context.pixels_per_cm, 2)} px/cm`
                : "Not calibrated"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink/65">
          {encounter.capture_context?.pixels_per_cm
            ? "Centimeter measurements are normalized from the visible reference supplied at capture."
            : "Add a ruler, marker, or color card at capture time to unlock AI-estimated centimeter measurements."}
        </p>
      </div>

      {analysis.meta.warnings.length > 0 ? (
        <div className="rounded-[28px] border border-gold/20 bg-gold/10 p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
            Runtime warnings
          </p>
          <div className="mt-3 space-y-2">
            {analysis.meta.warnings.map((warning) => (
              <p key={warning} className="text-sm leading-6 text-ink/70">
                {warning}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              Images
            </p>
            <p className="mt-1 text-sm text-ink/65">
              Original, segmentation overlay, binary mask, and wound crop.
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-coral" />
        </div>

        <div className="grid gap-3">
          {[
            { label: "Original", src: upload?.image_url },
            { label: "Segmentation overlay", src: analysis.roi.overlay_url },
            { label: "Segmentation mask", src: analysis.roi.mask_url },
            { label: "ROI crop", src: analysis.roi.crop_url }
          ].map((image) => (
            <div key={image.label} className="overflow-hidden rounded-[24px] bg-mist">
              <div className="border-b border-white/70 px-4 py-3 text-sm font-semibold text-ink">
                {image.label}
              </div>
              {image.src ? (
                <Image
                  src={image.src}
                  alt={image.label}
                  width={960}
                  height={720}
                  unoptimized
                  className="h-64 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-ink/45">
                  Not available
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "rounded-[30px] border p-5 shadow-card",
          analysis.concern_output.label === "unable_to_determine"
            ? "border-gold/20 bg-gold/10"
            : "border-teal/20 bg-teal/10"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              Concern output
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              {formatLabel(analysis.concern_output.label)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/70">{analysis.concern_output.note}</p>
          </div>
          {analysis.concern_output.label === "unable_to_determine" ? (
            <AlertTriangle className="h-6 w-6 text-gold" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-teal" />
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
              Confidence
            </p>
            <p className="mt-2 text-lg font-semibold text-ink">
              {analysis.concern_output.confidence}
            </p>
            <p className="mt-1 text-sm text-ink/65">{analysis.concern_output.confidence_text}</p>
          </div>
          <div className="rounded-[24px] bg-white/75 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/55">
              Stage suspicion
            </p>
            <p className="mt-2 text-lg font-semibold text-ink">
              {analysis.concern_output.stage_suspicion ?? "not assigned"}
            </p>
            <p className="mt-1 text-sm text-ink/65">For clinician review only.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "ROI found",
            value: analysis.roi.found ? "Segmented wound mask" : "Fallback region",
            detail: analysis.roi.found
              ? "Segmentation mask extracted from the source image."
              : "Fallback region used because mask confidence was limited."
          },
          {
            label: "Mask bounds",
            value: formatBBox(analysis.roi.bbox),
            detail: "x1, y1, x2, y2 coordinates derived from the segmentation mask."
          },
          {
            label: "Body site",
            value: analysis.risk_form.body_site,
            detail: "Structured location captured for the wound timeline."
          },
          {
            label: "Clinician severity",
            value:
              analysis.risk_form.clinician_severity_score === null
                ? "Not entered"
                : `${analysis.risk_form.clinician_severity_score} / 10`,
            detail: "Manual severity scoring for safer interpretation of wound seriousness."
          },
          {
            label: "Manual confirmation",
            value: formatLabel(analysis.risk_form.clinician_confirmation_status),
            detail:
              analysis.risk_form.clinician_confirmation_note?.trim() ||
              "No clinician confirmation note entered."
          },
          {
            label: "Model adapter",
            value: analysis.meta.model_name,
            detail: "Current encounter inference adapter."
          }
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[26px] border border-white/70 bg-white/82 p-4 shadow-card"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              {item.label}
            </p>
            <p className="mt-2 text-base font-semibold text-ink">{item.value}</p>
            <p className="mt-1 text-sm leading-6 text-ink/65">{item.detail}</p>
          </div>
        ))}
      </div>

      <ProbabilityMeter
        label="Pressure-injury concern probability"
        value={analysis.classification.pressure_injury_probability}
        accent="coral"
      />

      <div className="grid gap-3">
        {Object.entries(analysis.classification.class_probabilities).map(([label, value], index) => (
          <ProbabilityMeter
            key={label}
            label={formatLabel(label)}
            value={value}
            accent={index === 0 ? "teal" : index === 1 ? "coral" : "gold"}
          />
        ))}
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
              Wound metrics
            </p>
            <p className="mt-1 text-sm text-ink/65">
              AI-estimated values stay separate from clinician-entered assessment values.
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-[20px] bg-mist px-4 py-3 text-sm leading-6 text-ink/70">
          {encounter.capture_context?.pixels_per_cm
            ? `Calibrated capture is active at ${round(
                encounter.capture_context.pixels_per_cm,
                2
              )} px/cm, so centimeter values are populated from the wound mask.`
            : "Centimeter values populate when a capture reference is supplied. Manual entries remain separate from AI estimates."}
        </p>
        <div className="mt-4 grid gap-3">
          {metricCards.map((card) => (
            <div key={card.label} className="rounded-[24px] bg-mist p-4">
              <p className="text-sm font-semibold text-ink">{card.label}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
                    AI estimated
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink">{card.ai}</p>
                </div>
                <div className="rounded-[20px] bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
                    Clinician entered
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink">{card.clinician}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/65">{card.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          ROI quality flags
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {analysis.roi.quality_flags.length > 0 ? (
            analysis.roi.quality_flags.map((flag) => (
              <span
                key={flag}
                className="rounded-full border border-ink/10 bg-mist px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/65"
              >
                {formatLabel(flag)}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-sage/30 bg-sage/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sage">
              No major flags
            </span>
          )}
        </div>
        <p className="mt-4 text-sm text-ink/65">
          Top class: {formatLabel(analysis.classification.top_class)} at{" "}
          {toPercent(analysis.classification.top_probability)}.
        </p>
        <p className="mt-1 text-sm text-ink/65">
          Segmentation method: {analysis.roi.segmentation_method}. Mask area:{" "}
          {analysis.roi.mask_area_px ? round(analysis.roi.mask_area_px, 0) : "Not available"} px.
        </p>
        <p className="mt-1 text-sm text-ink/65">
          Crop size:{" "}
          {analysis.roi.crop_dimensions
            ? `${analysis.roi.crop_dimensions.width} x ${analysis.roi.crop_dimensions.height}`
            : "Not available"}
          .
        </p>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Prevention checklist
        </p>
        <div className="mt-3 space-y-3">
          {analysis.prevention_checklist.map((item) => (
            <div key={item.id} className="rounded-[22px] bg-mist px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-teal">
                  {item.priority}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink/65">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      <StickyActionBar>
        <button
          type="button"
          onClick={() => router.push(`/cases/${params.caseId}/review`)}
          className="w-full rounded-[24px] bg-ink px-5 py-4 text-base font-semibold text-white shadow-float transition hover:bg-teal"
        >
          Review note and wound assessment
        </button>
      </StickyActionBar>
    </AppShell>
  );
}
