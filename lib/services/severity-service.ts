import { clamp, round } from "@/lib/utils";
import {
  createEmptyClinicianSeverityReview,
  type ClassificationResult,
  type ClinicianSeverityReview,
  type ConfidenceLevel,
  type RiskForm,
  type ROIResult,
  type SeverityAssessment,
  type SeverityLevel,
  type WoundMetrics
} from "@/lib/types/schema";

type SeverityInput = {
  classification: ClassificationResult;
  riskForm: RiskForm;
  roi: ROIResult;
  woundMetrics: WoundMetrics;
};

function toConfidenceLevel(value: string | null | undefined): ConfidenceLevel | null {
  switch (value) {
    case "very_low":
    case "low":
    case "moderate":
    case "high":
    case "very_high":
    case "unknown":
      return value;
    default:
      return null;
  }
}

function countRiskSignals(riskForm: RiskForm) {
  return [
    riskForm.mobility_limited,
    riskForm.moisture_issue,
    riskForm.nutrition_risk,
    riskForm.device_present,
    riskForm.previous_pressure_injury,
    !riskForm.support_surface_in_use
  ].filter(Boolean).length;
}

export function getSeverityLevel(score: number | null | undefined): SeverityLevel | null {
  if (score === null || score === undefined) {
    return null;
  }

  if (score >= 80) {
    return "critical";
  }

  if (score >= 60) {
    return "high";
  }

  if (score >= 35) {
    return "moderate";
  }

  return "low";
}

function getSeverityConfidence(
  measurementConfidence: ConfidenceLevel | null,
  roi: ROIResult
): ConfidenceLevel | null {
  if (
    roi.quality_flags.includes("image_too_dark") ||
    roi.quality_flags.includes("possible_motion_blur") ||
    roi.quality_flags.includes("fallback_bbox_used")
  ) {
    return "low";
  }

  return measurementConfidence;
}

function buildSupportingSignals({
  riskForm,
  woundMetrics
}: Pick<SeverityInput, "riskForm" | "woundMetrics">) {
  const aiMetrics = woundMetrics.ai_estimated;
  const signals: string[] = [];

  if (countRiskSignals(riskForm) >= 4) {
    signals.push("multiple pressure-risk factors are present");
  }

  if ((aiMetrics.tissue_composition?.eschar ?? 0) >= 15) {
    signals.push("eschar burden is visually present");
  }

  if ((aiMetrics.tissue_composition?.slough ?? 0) >= 20) {
    signals.push("slough burden suggests non-viable tissue");
  }

  if (
    aiMetrics.periwound_findings.some((finding) =>
      finding.toLowerCase().includes("erythema")
    )
  ) {
    signals.push("periwound erythema signal is present");
  }

  if (aiMetrics.exudate_estimate?.toLowerCase().includes("moisture")) {
    signals.push("surface moisture or drainage signal is present");
  }

  if ((aiMetrics.shape_regularity_score ?? 100) < 50) {
    signals.push("wound contour is irregular");
  }

  if (signals.length === 0) {
    signals.push("severity estimate is driven mainly by class probability and risk context");
  }

  return signals;
}

function buildUncertaintyReasons(roi: ROIResult, measurementConfidence: ConfidenceLevel | null) {
  const reasons = roi.quality_flags.map((flag) => flag.replace(/_/g, " "));

  if (measurementConfidence === "low") {
    reasons.push("measurement confidence is low");
  }

  return Array.from(new Set(reasons));
}

function buildSeveritySummary(
  level: SeverityLevel | null,
  score: number | null | undefined,
  signals: string[]
) {
  if (score === null || score === undefined || !level) {
    return "Structured severity estimate is unavailable for this encounter.";
  }

  const leadSignal = signals[0] ?? "current image and risk context";
  return `AI severity estimate: ${level} (${score}/100), driven by ${leadSignal}.`;
}

export function deriveSeverityAssessment({
  classification,
  riskForm,
  roi,
  woundMetrics
}: SeverityInput): SeverityAssessment {
  const aiMetrics = woundMetrics.ai_estimated;
  const pressureProbability = round(classification.pressure_injury_probability * 40, 0);
  const tissueLossCues = round(
    clamp(
      ((100 - (aiMetrics.shape_regularity_score ?? 100)) * 0.16) +
        ((aiMetrics.periwound_findings.some((finding) =>
          finding.toLowerCase().includes("erythema")
        )
          ? 8
          : 0) +
          (aiMetrics.periwound_findings.some((finding) =>
            finding.toLowerCase().includes("history")
          )
            ? 4
            : 0)),
      0,
      25
    ),
    0
  );
  const tissueCompositionBurden = round(
    clamp(
      (aiMetrics.tissue_composition?.slough ?? 0) * 0.18 +
        (aiMetrics.tissue_composition?.eschar ?? 0) * 0.26,
      0,
      25
    ),
    0
  );
  const riskContext = round(
    clamp(
      countRiskSignals(riskForm) * 5 +
        (riskForm.formal_risk_score !== null
          ? Math.max(0, 18 - riskForm.formal_risk_score) * 0.7
          : 0),
      0,
      25
    ),
    0
  );
  const imageQualityModifier = round(
    clamp(((aiMetrics.image_quality_score ?? 70) - 70) * 0.25, -10, 10),
    0
  );
  const score =
    aiMetrics.severity_score ??
    Math.round(
      clamp(
        pressureProbability +
          tissueLossCues +
          tissueCompositionBurden +
          riskContext +
          imageQualityModifier,
        0,
        100
      )
    );
  const level = getSeverityLevel(score);
  const confidence = getSeverityConfidence(toConfidenceLevel(aiMetrics.measurement_confidence), roi);
  const supportingSignals = buildSupportingSignals({ riskForm, woundMetrics });
  const uncertaintyReasons = buildUncertaintyReasons(roi, confidence);

  return {
    ai_estimated: {
      score,
      level,
      confidence,
      summary: buildSeveritySummary(level, score, supportingSignals),
      supporting_signals: supportingSignals,
      uncertainty_reasons: uncertaintyReasons,
      components: {
        pressure_probability: pressureProbability,
        tissue_loss_cues: tissueLossCues,
        tissue_composition_burden: tissueCompositionBurden,
        risk_context: riskContext,
        image_quality_modifier: imageQualityModifier
      }
    },
    clinician_review: createEmptyClinicianSeverityReview()
  };
}

export function normalizeClinicianSeverityReview(
  review: ClinicianSeverityReview,
  fallbackScore?: number | null
): ClinicianSeverityReview {
  const score = review.score ?? fallbackScore ?? null;
  const level = review.level ?? getSeverityLevel(score);

  return {
    ...review,
    score,
    level,
    summary:
      review.summary ||
      (score !== null && level
        ? `Clinician-reviewed severity: ${level} (${score}/100).`
        : ""),
    confidence:
      review.confidence ??
      (review.status === "confirmed" || review.status === "overridden" ? "high" : null)
  };
}
