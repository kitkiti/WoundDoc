import type { CaseProgression, ConcernOutput, RoiResult } from "@/lib/types/schema";

export function deriveLongitudinalAlerts({
  progression,
  concernOutput,
  roi
}: {
  progression: CaseProgression;
  concernOutput: ConcernOutput;
  roi: RoiResult;
}) {
  const alerts: Array<{
    id: string;
    level: "info" | "watch" | "urgent";
    title: string;
    detail: string;
    action: string;
  }> = [];

  if (!progression.available) {
    alerts.push({
      id: "progression-insufficient",
      level: "info",
      title: "Baseline only",
      detail: "No prior comparable encounter is available for longitudinal trend review.",
      action: "Capture the next encounter with a visible reference to enable progression checks."
    });
  }

  if (progression.status === "worsening") {
    alerts.push({
      id: "progression-worsening",
      level: "urgent",
      title: "Worsening trend detected",
      detail: progression.summary,
      action: "Escalate for same-shift clinician reassessment and verify offloading plan."
    });
  }

  if (progression.status === "stable" && (progression.days_since_previous ?? 0) >= 7) {
    alerts.push({
      id: "progression-no-improvement",
      level: "watch",
      title: "No measurable improvement",
      detail: `Trend remains stable over ${progression.days_since_previous} day(s).`,
      action: "Review barriers to healing and document whether current plan should change."
    });
  }

  if (roi.quality_flags.length > 0) {
    alerts.push({
      id: "capture-comparability",
      level: "watch",
      title: "Capture quality may limit comparison",
      detail: `Quality flags: ${roi.quality_flags.join(", ")}.`,
      action: "Repeat capture with better framing/lighting if clinical decisions depend on trend deltas."
    });
  }

  if (concernOutput.escalation_level === "urgent" || concernOutput.escalation_level === "critical") {
    alerts.push({
      id: "high-concern",
      level: "urgent",
      title: "High current encounter concern",
      detail: concernOutput.confidence_text,
      action: "Prioritize bedside review and confirm the staged concern with direct exam."
    });
  }

  return alerts;
}
