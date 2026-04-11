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
    return { status: "stable" as const, label: metric.label, deltaPercent: delta * 100 };
  }

  if (metric.improvementDirection === "decrease") {
    return {
      status: delta < 0 ? ("improving" as const) : ("worsening" as const),
      label: metric.label,
      deltaPercent: delta * 100
    };
  }

  return null;
}

type ProgressionInput = {
  currentCreatedAt: string;
  currentMetrics: MetricAssessment | null;
  previousEncounterId: string;
  previousCreatedAt: string;
  previousMetrics: MetricAssessment | null;
};

export function deriveProgressionFromAssessments(input: ProgressionInput): CaseProgression {
  const previousDate = new Date(input.previousCreatedAt);
  const currentDate = new Date(input.currentCreatedAt);
  const daysSincePrevious = Math.max(
    0,
    Math.round((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (!input.currentMetrics || !input.previousMetrics) {
    return caseProgressionSchema.parse({
      available: false,
      status: "insufficient_data",
      summary: "Progression is unavailable because one of the encounters is missing wound metrics.",
      days_since_previous: daysSincePrevious,
      compared_encounter_id: input.previousEncounterId,
      evaluated_metrics: [],
      metric_deltas: []
    });
  }

  const evaluations = COMPARABLE_METRICS.map((metric) => ({
    metric,
    result: evaluateMetric(metric, input.currentMetrics!, input.previousMetrics!)
  })).filter(
    (
      entry
    ): entry is {
      metric: ComparableMetric;
      result: { status: "improving" | "stable" | "worsening"; label: string; deltaPercent: number };
    } => Boolean(entry.result)
  );

  if (evaluations.length === 0) {
    return caseProgressionSchema.parse({
      available: false,
      status: "insufficient_data",
      summary: "Progression is unavailable because no shared comparable metrics were found.",
      days_since_previous: daysSincePrevious,
      compared_encounter_id: input.previousEncounterId,
      evaluated_metrics: [],
      metric_deltas: []
    });
  }

  const worseningCount = evaluations.filter((item) => item.result.status === "worsening").length;
  const improvingCount = evaluations.filter((item) => item.result.status === "improving").length;
  const status =
    worseningCount > improvingCount
      ? "worsening"
      : improvingCount > worseningCount
        ? "improving"
        : "stable";

  const comparedDate = previousDate.toLocaleDateString("en-US", {
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
    days_since_previous: daysSincePrevious,
    compared_encounter_id: input.previousEncounterId,
    evaluated_metrics: evaluations.map((item) => item.result.label),
    metric_deltas: evaluations.map((item) => ({
      key: item.metric.key,
      label: item.metric.label,
      current_value: input.currentMetrics?.[item.metric.key] as number,
      previous_value: input.previousMetrics?.[item.metric.key] as number,
      delta_percent: item.result.deltaPercent,
      status: item.result.status
    }))
  });
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
      days_since_previous: null,
      compared_encounter_id: null,
      evaluated_metrics: [],
      metric_deltas: []
    });
  }

  const currentEncounter = sorted[currentIndex];
  const previousEncounter = sorted[currentIndex - 1];
  const currentMetrics = resolvePreferredMetrics(currentEncounter);
  const previousMetrics = resolvePreferredMetrics(previousEncounter);

  return deriveProgressionFromAssessments({
    currentCreatedAt: currentEncounter.created_at,
    currentMetrics,
    previousEncounterId: previousEncounter.encounter_id,
    previousCreatedAt: previousEncounter.created_at,
    previousMetrics
  });
}
