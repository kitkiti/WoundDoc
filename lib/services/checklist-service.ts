import type { ChecklistItem, ClassificationResult, ConcernOutput, RiskForm, RoiResult } from "@/lib/types/schema";

export function generateChecklist({ concernOutput, riskForm }: { classification: ClassificationResult; concernOutput: ConcernOutput; riskForm: RiskForm; roi: RoiResult; }): ChecklistItem[] {
  return [
    {
      id: "reposition",
      title: "Repositioning plan",
      description: "Confirm repositioning frequency and offloading approach.",
      rationale: "Mobility and pressure exposure are key prevention factors.",
      priority: concernOutput.escalation_level,
      status: "pending",
      selected: true,
      clinician_note: riskForm.support_surface_in_use ? "Support surface already in use." : ""
    },
    {
      id: "skin-check",
      title: "Skin reassessment",
      description: "Repeat focused skin check at next rounding interval.",
      rationale: "Short-interval reassessment reduces missed progression.",
      priority: "routine",
      status: "pending",
      selected: true,
      clinician_note: ""
    }
  ];
}
