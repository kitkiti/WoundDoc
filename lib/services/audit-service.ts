import {
  createDefaultAuditTrail,
  type AuditTrail,
  type CaptureContext,
  type ClinicianSeverityReview,
  type MetricAssessment,
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

function hasMetricValue(field: keyof MetricAssessment, assessment: MetricAssessment) {
  const value = assessment[field];

  if (field === "tissue_composition") {
    return hasTissueCompositionValue(assessment.tissue_composition);
  }

  if (field === "periwound_findings") {
    return hasStringListValue(assessment.periwound_findings);
  }

  if (field === "exudate_estimate" || field === "measurement_confidence") {
    return hasStringValue(typeof value === "string" ? value : null);
  }

  return hasNumericValue(value as number | null | undefined);
}

function getMetricSource(
  field: keyof MetricAssessment,
  aiMetrics: MetricAssessment,
  clinicianMetrics: MetricAssessment
): AuditTrail["metric_sources"][number]["source"] {
  if (hasMetricValue(field, clinicianMetrics)) {
    return "clinician";
  }

  if (hasMetricValue(field, aiMetrics)) {
    return "ai";
  }

  return "unknown";
}

function getMetricConfidence(
  field: keyof MetricAssessment,
  aiMetrics: MetricAssessment,
  clinicianMetrics: MetricAssessment
): AuditTrail["metric_sources"][number]["confidence"] {
  if (getMetricSource(field, aiMetrics, clinicianMetrics) === "clinician") {
    return "high";
  }

  return (clinicianMetrics.measurement_confidence ??
    aiMetrics.measurement_confidence ??
    "unknown") as AuditTrail["metric_sources"][number]["confidence"];
}

function deriveUncertaintyReason(roi: ROIResult, captureContext?: CaptureContext) {
  const reasons = roi.quality_flags.map((flag: string) => flag.replace(/_/g, " "));

  if (!captureContext?.pixels_per_cm) {
    reasons.push("no calibrated capture reference supplied");
  }

  return Array.from(new Set(reasons)).join("; ");
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
  const fields: Array<keyof MetricAssessment> = [
    "area_px",
    "area_cm2",
    "length_cm",
    "width_cm",
    "perimeter_cm",
    "depth_cm",
    "shape_regularity_score",
    "tissue_composition",
    "periwound_findings",
    "exudate_estimate",
    "image_quality_score",
    "measurement_confidence",
    "severity_score"
  ];
  const uncertaintyReason = deriveUncertaintyReason(roi, captureContext);
  const metricSources: AuditTrail["metric_sources"] = fields.map((field) => ({
    metric: field,
    source:
      field === "severity_score" && getMetricSource(field, aiMetrics, clinicianMetrics) === "unknown"
        ? "derived"
        : getMetricSource(field, aiMetrics, clinicianMetrics),
    confidence: getMetricConfidence(field, aiMetrics, clinicianMetrics),
    requires_confirmation: getMetricSource(field, aiMetrics, clinicianMetrics) !== "clinician",
    uncertainty_reason: uncertaintyReason
  }));

  const clinicianOverride =
    clinicianSeverityReview?.status === "overridden" ||
    metricSources.some(
      (source) =>
        source.source === "clinician" &&
        hasMetricValue(source.metric as keyof MetricAssessment, aiMetrics)
    );

  return {
    ...createDefaultAuditTrail(),
    model_version: modelVersion ?? "woundwatch-heuristic-v2",
    generated_at: reviewedAt ?? new Date().toISOString(),
    clinician_override: Boolean(clinicianOverride),
    override_fields: metricSources
      .filter((source) => source.source === "clinician")
      .map((source) => source.metric),
    metric_sources: metricSources
  };
}
