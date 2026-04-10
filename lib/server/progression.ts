import {
  caseProgressionSchema,
  type CaseProgression,
  type EncounterRecord,
  type MetricAssessment
} from "@/lib/types/schema";

type ComparableMetric = {
  key: "area_cm2" | "area_px" | "severity_score";
  label: string;
  improvementDirection: "decrease";
  minimumRelativeChange: number;
};

const COMPARABLE_METRICS: ComparableMetric[] = [
  {
    key: "area_cm2",
    label: "Area (cm2)",
    improvementDirection: "decrease",
    minimumRelativeChange: 0.1
  },
  {
    key: "area_px",
    label: "Area (px)",
    improvementDirection: "decrease",
    minimumRelativeChange: 0.1
  },
  {
    key: "severity_score",
    label: "Severity score",
    improvementDirection: "decrease",
    minimumRelativeChange: 0.15
  }
];

function resolvePreferredMetrics(encounter: EncounterRecord): MetricAssessment | null {
  const fromReview = encounter.review?.clinician_wound_assessment;
  if (fromReview) return fromReview;

  const analysis = encounter.analysis?.wound_metrics;
  if (!analysis) return null;

  const hasClinicianInput = Object.values(analysis.clinician_entered).some(
    (value) => typeof value === "number"
  );
  return hasClinicianInput ? analysis.clinician_entered : analysis.ai_estimated;
}

function evaluateMetric(
  metric: ComparableMetric,
  current: MetricAssessment,
  previous: MetricAssessment
) {
  const currentValue = current[metric.key];
  const previousValue = previous[metric.key];

  if (typeof currentValue !== "number" || typeof previousValue !== "number") {
    return null;
  }

  const base = Math.abs(previousValue) < 0.00001 ? 1 : Math.abs(previousValue);
  const delta = (currentValue - previousValue) / base;

  if (Math.abs(delta) < metric.minimumRelativeChange) {
    return { status: "stable" as const, label: metric.label };
  }

  if (metric.improvementDirection === "decrease") {
    return {
      status: delta < 0 ? ("improving" as const) : ("worsening" as const),
      label: metric.label
    };
  }

  return null;
}

export function deriveCaseProgression(encounters: EncounterRecord[], currentEncounterId: string): CaseProgression {
  const sorted = [...encounters].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const currentIndex = sorted.findIndex((entry) => entry.encounter_id === currentEncounterId);

  if (currentIndex <= 0) {
    return caseProgressionSchema.parse({
      available: false,
      status: "insufficient_data",
      summary: "At least two encounters are required before progression can be compared.",
      compared_encounter_id: null,
      evaluated_metrics: []
    });
  }

  const currentEncounter = sorted[currentIndex];
  const previousEncounter = sorted[currentIndex - 1];
  const currentMetrics = resolvePreferredMetrics(currentEncounter);
  const previousMetrics = resolvePreferredMetrics(previousEncounter);

  if (!currentMetrics || !previousMetrics) {
    return caseProgressionSchema.parse({
      available: false,
      status: "insufficient_data",
      summary: "Progression is unavailable because one of the encounters is missing wound metrics.",
      compared_encounter_id: previousEncounter.encounter_id,
      evaluated_metrics: []
    });
  }

  const evaluations = COMPARABLE_METRICS.map((metric) =>
    evaluateMetric(metric, currentMetrics, previousMetrics)
  ).filter((entry): entry is { status: "improving" | "stable" | "worsening"; label: string } =>
    Boolean(entry)
  );

  if (evaluations.length === 0) {
    return caseProgressionSchema.parse({
      available: false,
      status: "insufficient_data",
      summary: "Progression is unavailable because no shared comparable metrics were found.",
      compared_encounter_id: previousEncounter.encounter_id,
      evaluated_metrics: []
    });
  }

  const worseningCount = evaluations.filter((item) => item.status === "worsening").length;
  const improvingCount = evaluations.filter((item) => item.status === "improving").length;
  const status =
    worseningCount > improvingCount
      ? "worsening"
      : improvingCount > worseningCount
        ? "improving"
        : "stable";

  const comparedDate = new Date(previousEncounter.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const summary =
    status === "stable"
      ? `Compared with ${comparedDate}, the wound appears stable across ${evaluations.length} metric${evaluations.length === 1 ? "" : "s"}.`
      : `Compared with ${comparedDate}, the wound appears ${status} based on ${evaluations.length} metric${evaluations.length === 1 ? "" : "s"}.`;

  return caseProgressionSchema.parse({
    available: true,
    status,
    summary,
    compared_encounter_id: previousEncounter.encounter_id,
    evaluated_metrics: evaluations.map((item) => item.label)
  });
}
