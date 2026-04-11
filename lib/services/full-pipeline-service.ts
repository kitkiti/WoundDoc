import { analyzeRoi } from "@/lib/services/roi-service";
import { deriveCalibratedMeasurements } from "@/lib/services/measurement-service";
import { parseRiskForm } from "@/lib/services/risk-form-service";
import { runClassifier } from "@/lib/services/classifier-service";
import { deriveConcernOutput } from "@/lib/services/concern-service";
import { deriveAuditTrail, deriveModelEvaluation } from "@/lib/services/evaluation-service";
import { generateChecklist } from "@/lib/services/checklist-service";
import { generateStructuredNote } from "@/lib/services/note-generator-service";
import { deriveLongitudinalAlerts } from "@/lib/services/alert-service";
import { deriveProgressionFromAssessments } from "@/lib/server/progression";
import {
  analysisOutputSchema,
  caseProgressionSchema,
  type CaptureContext,
  type EncounterRecord,
  type MetricAssessment
} from "@/lib/types/schema";

type Input = {
  encounterId: string;
  patientId: string;
  woundId: string;
  imagePath: string;
  captureContext: CaptureContext;
  riskForm: unknown;
  previousEncounter?: EncounterRecord | null;
  demoCaseId?: string;
};

export async function runFullPipeline(input: Input) {
  const riskForm = parseRiskForm(input.riskForm);
  const roi = await analyzeRoi({
    caseId: input.encounterId,
    artifactId: input.encounterId,
    imagePath: input.imagePath
  });
  const calibrated = deriveCalibratedMeasurements(roi, input.captureContext.pixels_per_cm);
  const classifierRun = await runClassifier({ imagePath: input.imagePath, riskForm, roi, demoCaseId: input.demoCaseId });
  const provisionalMetrics: MetricAssessment = {
    area_px: calibrated.area_px,
    area_cm2: calibrated.area_cm2,
    length_cm: calibrated.length_cm,
    width_cm: calibrated.width_cm,
    perimeter_cm: calibrated.perimeter_cm,
    depth_cm: null,
    shape_regularity_score: null,
    tissue_composition: null,
    periwound_findings: [],
    exudate_estimate: null,
    image_quality_score: null,
    measurement_confidence: calibrated.measurement_confidence,
    severity_score: Math.round(classifierRun.result.pressure_injury_probability * 10)
  };
  const previousMetrics =
    input.previousEncounter?.review?.clinician_wound_assessment ??
    input.previousEncounter?.analysis?.wound_metrics.clinician_entered ??
    input.previousEncounter?.analysis?.wound_metrics.ai_estimated ??
    null;
  const progression =
    input.previousEncounter && previousMetrics
      ? deriveProgressionFromAssessments({
          currentCreatedAt: new Date().toISOString(),
          currentMetrics: provisionalMetrics,
          previousEncounterId: input.previousEncounter.encounter_id,
          previousCreatedAt: input.previousEncounter.created_at,
          previousMetrics
        })
      : caseProgressionSchema.parse({
          available: false,
          status: "insufficient_data",
          summary: "At least two encounters are required before progression can be compared.",
          compared_encounter_id: null
        });
  const timestamp = new Date().toISOString();
  const evaluation = deriveModelEvaluation({
    roi,
    classification: classifierRun.result,
    metrics: provisionalMetrics,
    progression,
    captureContext: input.captureContext,
    generatedAt: timestamp
  });
  const concernOutput = deriveConcernOutput({
    classification: classifierRun.result,
    roi,
    riskForm,
    progression,
    confidenceGate: evaluation.confidence_gate
  });
  const audit = deriveAuditTrail({
    generatedAt: timestamp,
    classification: classifierRun.result,
    concern: concernOutput,
    metrics: provisionalMetrics
  });
  const longitudinalAlerts = deriveLongitudinalAlerts({ progression, concernOutput, roi });
  const preventionChecklist = generateChecklist({
    classification: classifierRun.result,
    concernOutput,
    riskForm,
    roi,
    progression
  });
  const structuredNote = generateStructuredNote({
    riskForm,
    classification: classifierRun.result,
    concernOutput,
    checklist: preventionChecklist,
    progression,
    longitudinalAlerts
  });

  const output = analysisOutputSchema.parse({
      meta: {
        encounter_id: input.encounterId,
        patient_id: input.patientId,
        wound_id: input.woundId,
        demo_mode: Boolean(input.demoCaseId),
        model_name: classifierRun.modelName,
        timestamp,
        warnings: classifierRun.warnings
      },
      roi,
      classification: classifierRun.result,
      evaluation,
      audit,
      concern_output: concernOutput,
      risk_form: riskForm,
      wound_metrics: {
        ai_estimated: {
          ...provisionalMetrics,
          tissue_composition: null,
          periwound_findings: [],
          exudate_estimate: null
        },
        clinician_entered: {
          area_px: null,
          area_cm2: null,
          length_cm: null,
          width_cm: null,
          perimeter_cm: null,
          depth_cm: null,
          shape_regularity_score: null,
          tissue_composition: null,
          periwound_findings: [],
          exudate_estimate: null,
          image_quality_score: null,
          measurement_confidence: null,
          severity_score: riskForm.clinician_severity_score
        },
        depth_guidance: "Depth cannot be inferred from a single 2D image.",
        structured_measurements: {
          ai_estimated: {},
          clinician_entered: {}
        }
      },
      longitudinal_alerts: longitudinalAlerts,
      prevention_checklist: preventionChecklist,
      structured_note: structuredNote
    });

  return {
    imagePath: input.imagePath,
    riskForm,
    output
  };
}
