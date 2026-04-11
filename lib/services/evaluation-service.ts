import type {
    AuditTrail,
    CaptureContext,
    CaseProgression,
    ClassificationResult,
    ConcernOutput,
    MetricAssessment,
    ModelEvaluation,
    RoiResult
} from "@/lib/types/schema";

function ratioToPercent(value: number) {
  return Math.round(value * 1000) / 10;
}

function statusFromThresholds(value: number, passMin: number, watchMin: number): "pass" | "watch" | "fail" {
  if (value >= passMin) return "pass";
  if (value >= watchMin) return "watch";
  return "fail";
}

export function deriveModelEvaluation({
  roi,
  classification,
  metrics,
  progression,
  captureContext,
  generatedAt
}: {
  roi: RoiResult;
  classification: ClassificationResult;
  metrics: MetricAssessment;
  progression: CaseProgression;
  captureContext: CaptureContext;
  generatedAt: string;
}): ModelEvaluation {
  const segmentationQuality = roi.mask_coverage_ratio ?? 0;
  const captureQuality =
    metrics.image_quality_score === null ? Math.max(0, 1 - roi.quality_flags.length * 0.2) : metrics.image_quality_score / 100;
  const measurementCompleteness = [metrics.area_cm2, metrics.length_cm, metrics.width_cm].filter((value) => value !== null)
    .length / 3;
  const progressionReadiness = progression.available ? 1 : 0;

  const criteria: ModelEvaluation["criteria"] = [
    {
      id: "segmentation_quality",
      label: "Segmentation quality",
      value: ratioToPercent(segmentationQuality),
      unit: "percent" as const,
      target: ">= 5% useful wound coverage",
      status: statusFromThresholds(segmentationQuality, 0.05, 0.02),
      note:
        segmentationQuality > 0
          ? "Mask coverage is based on ROI contour area fraction."
          : "No reliable mask area was detected."
    },
    {
      id: "capture_quality",
      label: "Capture quality",
      value: ratioToPercent(captureQuality),
      unit: "percent" as const,
      target: "No major quality flags",
      status: roi.quality_flags.length === 0 ? "pass" : roi.quality_flags.length <= 2 ? "watch" : "fail",
      note:
        roi.quality_flags.length === 0
          ? "Image quality flags were not raised."
          : `Quality flags present: ${roi.quality_flags.join(", ")}.`
    },
    {
      id: "measurement_completeness",
      label: "Measurement completeness",
      value: ratioToPercent(measurementCompleteness),
      unit: "percent" as const,
      target: "Area + length + width available",
      status: statusFromThresholds(measurementCompleteness, 1, 0.67),
      note: captureContext.pixels_per_cm
        ? "Calibrated capture enabled centimeter outputs."
        : "No calibration reference was provided; centimeter outputs are limited."
    },
    {
      id: "classification_margin",
      label: "Classification confidence margin",
      value: ratioToPercent(classification.top_probability),
      unit: "percent" as const,
      target: "Top class probability >= 70%",
      status: statusFromThresholds(classification.top_probability, 0.7, 0.55),
      note: `Top class ${classification.top_class}.`
    },
    {
      id: "progression_coverage",
      label: "Progression comparability",
      value: ratioToPercent(progressionReadiness),
      unit: "percent" as const,
      target: "Prior encounter available for comparison",
      status: progressionReadiness === 1 ? "pass" : "watch",
      note: progression.summary
    }
  ];

  const hasFailure = criteria.some((criterion) => criterion.status === "fail");
  const hasWatch = criteria.some((criterion) => criterion.status === "watch");
  const confidenceGate = hasFailure
    ? "low"
    : classification.top_probability >= 0.85 && roi.quality_flags.length === 0
      ? "high"
      : "moderate";

  return {
    ready_for_deployment: !hasFailure,
    overall_status: hasFailure ? "fail" : hasWatch ? "watch" : "pass",
    confidence_gate: confidenceGate,
    criteria,
    generated_at: generatedAt
  };
}

export function deriveAuditTrail({
  generatedAt,
  classification,
  concern,
  metrics
}: {
  generatedAt: string;
  classification: ClassificationResult;
  concern: ConcernOutput;
  metrics: MetricAssessment;
}): AuditTrail {
  const metricSources: AuditTrail["metric_sources"] = [
    {
      metric: "area_cm2",
      source: metrics.area_cm2 === null ? "unknown" : "ai",
      confidence: (metrics.measurement_confidence ?? "unknown") as AuditTrail["metric_sources"][number]["confidence"],
      requires_confirmation: true,
      uncertainty_reason: classification.uncertainty_reasons[0] ?? ""
    },
    {
      metric: "severity_score",
      source: "derived",
      confidence: concern.confidence === "high" || concern.confidence === "very_high" ? "high" : "moderate",
      requires_confirmation: true,
      uncertainty_reason: concern.confidence_text
    }
  ];

  return {
    model_name: classification.model_name ?? classification.adapter_name ?? "unknown",
    model_version: classification.model_version ?? "unknown",
    model_card: classification.model_card ?? "",
    inference_id: "",
    generated_at: generatedAt,
    clinician_override: false,
    override_fields: [],
    metric_sources: metricSources
  };
}
