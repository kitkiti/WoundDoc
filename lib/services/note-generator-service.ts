import type { ChecklistItem, ClassificationResult, ConcernOutput, RiskForm } from "@/lib/types/schema";

export function generateStructuredNote({ riskForm, classification, concernOutput, checklist }: { riskForm: RiskForm; classification: ClassificationResult; concernOutput: ConcernOutput; checklist: ChecklistItem[]; }) {
  const summary = `${riskForm.body_site || "Wound"}: ${concernOutput.label} (${Math.round(classification.pressure_injury_probability * 100)}%).`;
  const checklistText = checklist.map((item) => `- ${item.title}`).join("\n");
  const fullNote = [
    "Bedside wound assessment support output (non-diagnostic):",
    `Site: ${riskForm.body_site || "not specified"}`,
    `Concern: ${concernOutput.label}`,
    `Confidence: ${concernOutput.confidence_text}`,
    `Clinician severity score (0-10): ${riskForm.clinician_severity_score ?? "not entered"}`,
    `Clinician confirmation status: ${riskForm.clinician_confirmation_status}`,
    riskForm.clinician_confirmation_note
      ? `Clinician confirmation note: ${riskForm.clinician_confirmation_note}`
      : "Clinician confirmation note: not entered",
    "Recommended prevention checklist:",
    checklistText || "- No items generated"
  ].join("\n");

  return {
    summary,
    full_note: fullNote,
    copilot_statement:
      "AI-generated support for documentation and prevention planning; clinician review and confirmation required."
  };
}
