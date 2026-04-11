import {
  createDefaultAuditTrail,
  type AuditTrail,
  type CaptureContext,
  type ClinicianSeverityReview,
  type MetricAssessment,
  type MetricSourceType,
  type ROIResult
} from "@/lib/types/schema";

type AuditInput = {
  modelVersion?: string;
  roi: ROIResult;
  captureContext?: CaptureContext;
  aiMetrics: MetricAssessment;
  clinicianMetrics: MetricAssessment;
  clinicianSeverityReview?: ClinicianSeverityReview;
  reviewedAt?: string | null;
};

function hasNumericValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasStringValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasStringListValue(value: string[] | null | undefined) {
  return Array.isArray(value) && value.length > 0;
}

function hasTissueCompositionValue(value: MetricAssessment["tissue_composition"]) {
  if (!value) {
    return false;
  }

  return Object.values(value).some((entry) => hasNumericValue(entry));
}

function hasMetricValue(
  field: keyof MetricAssessment,
  assessment: MetricAssessment
) {
  const value = assessment[field];

  if (field === "tissue_composition") {
    return hasTissueCompositionValue(assessment.tissue_composition);
  }

  if (field === "periwound_findings") {
    return hasStringListValue(assessment.periwound_findings);
  }

  if (field === "exudate_estimate" || field === "measurement_confidence") {
    return hasStringValue(String(value ?? "").trim() || null);
  }

  return hasNumericValue(value as number | null | undefined);
}

function getMetricSource(
  field: keyof MetricAssessment,
  aiMetrics: MetricAssessment,
  clinicianMetrics: MetricAssessment
): MetricSourceType {
  if (hasMetricValue(field, clinicianMetrics)) {
    return "manual_entered";
  }

  if (hasMetricValue(field, aiMetrics)) {
    return "ai_generated";
  }

  return "not_available";
}

function deriveUncertaintyReasons(roi: ROIResult, captureContext?: CaptureContext) {
  const reasons = roi.quality_flags.map((flag) => flag.replace(/_/g, " "));

  if (!captureContext?.pixels_per_cm) {
    reasons.push("no calibrated capture reference supplied");
  }

  reasons.push("depth is not inferable from a single 2D mobile photo");

  return Array.from(new Set(reasons));
}

export function deriveAuditTrail({
  modelVersion,
  roi,
  captureContext,
  aiMetrics,
  clinicianMetrics,
  clinicianSeverityReview,
  reviewedAt
}: AuditInput): AuditTrail {
  const metricSources = {
    area_px: getMetricSource("area_px", aiMetrics, clinicianMetrics),
    area_cm2: getMetricSource("area_cm2", aiMetrics, clinicianMetrics),
    length_cm: getMetricSource("length_cm", aiMetrics, clinicianMetrics),
    width_cm: getMetricSource("width_cm", aiMetrics, clinicianMetrics),
    perimeter_cm: getMetricSource("perimeter_cm", aiMetrics, clinicianMetrics),
    depth_cm: getMetricSource("depth_cm", aiMetrics, clinicianMetrics),
    shape_regularity_score: getMetricSource(
      "shape_regularity_score",
      aiMetrics,
      clinicianMetrics
    ),
    tissue_composition: getMetricSource("tissue_composition", aiMetrics, clinicianMetrics),
    periwound_findings: getMetricSource("periwound_findings", aiMetrics, clinicianMetrics),
    exudate_estimate: getMetricSource("exudate_estimate", aiMetrics, clinicianMetrics),
    image_quality_score: getMetricSource("image_quality_score", aiMetrics, clinicianMetrics),
    measurement_confidence: getMetricSource(
      "measurement_confidence",
      aiMetrics,
      clinicianMetrics
    ),
    severity_score: getMetricSource("severity_score", aiMetrics, clinicianMetrics)
  };

  const clinicianOverride =
    clinicianSeverityReview?.status === "overridden" ||
    Object.entries(metricSources).some(([field, source]) => {
      if (source !== "manual_entered") {
        return false;
      }

      return hasMetricValue(field as keyof MetricAssessment, aiMetrics);
    });

  return {
    ...createDefaultAuditTrail(),
    model_version: modelVersion ?? "woundwatch-heuristic-v2",
    measurement_confidence:
      clinicianMetrics.measurement_confidence ?? aiMetrics.measurement_confidence,
    uncertainty_reasons: deriveUncertaintyReasons(roi, captureContext),
    clinician_override: Boolean(clinicianOverride),
    metric_sources: metricSources,
    reviewed_at: reviewedAt ?? null
  };
}
