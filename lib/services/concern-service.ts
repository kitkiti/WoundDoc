import type { ClassificationResult, ConcernOutput, RiskForm, RoiResult } from "@/lib/types/schema";

export function deriveConcernOutput({ classification, roi, riskForm }: { classification: ClassificationResult; roi: RoiResult; riskForm: RiskForm; }): ConcernOutput {
  const p = classification.pressure_injury_probability;
  const clinicianConfirmed = riskForm.clinician_confirmation_status === "confirmed";
  const escalation_level = p > 0.8 ? "urgent" : p > 0.65 ? "watch" : "routine";
  const confidence = p > 0.8 ? "high" : p > 0.6 ? "moderate" : "low";

  return {
    label: p > 0.65 ? "pressure injury concern" : "monitoring recommended",
    confidence,
    confidence_text: `Model probability ${Math.round(p * 100)}%`,
    note: roi.found
      ? `ROI localized at ${riskForm.body_site || "reported site"}; clinician confirmation is ${clinicianConfirmed ? "recorded" : "still required"}.`
      : "ROI not localized; recommend repeat capture before relying on metrics.",
    stage_suspicion: "not assigned",
    escalation_level,
    supporting_signals: [
      ...(riskForm.mobility_limited ? ["mobility_limited"] : []),
      ...(riskForm.device_present ? ["device_present"] : []),
      ...(riskForm.clinician_severity_score !== null ? ["clinician_severity_score"] : []),
      ...(!clinicianConfirmed ? ["manual_confirmation_pending"] : []),
      ...(roi.quality_flags ?? [])
    ]
  };
}
