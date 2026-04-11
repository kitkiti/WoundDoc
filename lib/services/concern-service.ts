import type {
  CaseProgression,
  ClassificationResult,
  ConcernOutput,
  RiskForm,
  RoiResult
} from "@/lib/types/schema";

export function deriveConcernOutput({
  classification,
  roi,
  riskForm,
  progression
}: {
  classification: ClassificationResult;
  roi: RoiResult;
  riskForm: RiskForm;
  progression: CaseProgression;
}): ConcernOutput {
  const p = classification.pressure_injury_probability;
  const clinicianConfirmed = riskForm.clinician_confirmation_status === "confirmed";
  const baseEscalation = p > 0.8 ? "urgent" : p > 0.65 ? "watch" : "routine";
  const escalation_level =
    progression.status === "worsening"
      ? baseEscalation === "routine"
        ? "watch"
        : "urgent"
      : baseEscalation;
  const confidence = p > 0.8 ? "high" : p > 0.6 ? "moderate" : "low";
  const progressionNote =
    progression.available && progression.status !== "insufficient_data"
      ? ` Trend: ${progression.summary}`
      : "";

  return {
    label: p > 0.65 ? "pressure injury concern" : "monitoring recommended",
    confidence,
    confidence_text: `Model probability ${Math.round(p * 100)}%`,
    note: roi.found
      ? `ROI localized at ${riskForm.body_site || "reported site"}; clinician confirmation is ${clinicianConfirmed ? "recorded" : "still required"}.${progressionNote}`
      : "ROI not localized; recommend repeat capture before relying on metrics.",
    stage_suspicion: "not assigned",
    escalation_level,
    supporting_signals: [
      ...(riskForm.mobility_limited ? ["mobility_limited"] : []),
      ...(riskForm.device_present ? ["device_present"] : []),
      ...(riskForm.clinician_severity_score !== null ? ["clinician_severity_score"] : []),
      ...(!clinicianConfirmed ? ["manual_confirmation_pending"] : []),
      ...(progression.available ? [`progression_${progression.status}`] : []),
      ...(roi.quality_flags ?? [])
    ]
  };
}
