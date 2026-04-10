import { analyzeRoi } from "@/lib/services/roi-service";
import { deriveCalibratedMeasurements } from "@/lib/services/measurement-service";
import { parseRiskForm } from "@/lib/services/risk-form-service";
import { runClassifier } from "@/lib/services/classifier-service";
import { deriveConcernOutput } from "@/lib/services/concern-service";
import { generateChecklist } from "@/lib/services/checklist-service";
import { generateStructuredNote } from "@/lib/services/note-generator-service";
import { analysisOutputSchema, type CaptureContext } from "@/lib/types/schema";

type Input = {
  caseId: string;
  patientId: string;
  woundId: string;
  imagePath: string;
  captureContext: CaptureContext;
  riskForm: unknown;
  demoCaseId?: string;
};

export async function runFullPipeline(input: Input) {
  const riskForm = parseRiskForm(input.riskForm);
  const roi = await analyzeRoi({ caseId: input.caseId, imagePath: input.imagePath });
  const calibrated = deriveCalibratedMeasurements(roi, input.captureContext.pixels_per_cm);
  const classifierRun = await runClassifier({ imagePath: input.imagePath, riskForm, roi, demoCaseId: input.demoCaseId });
  const concernOutput = deriveConcernOutput({ classification: classifierRun.result, roi, riskForm });
  const preventionChecklist = generateChecklist({ classification: classifierRun.result, concernOutput, riskForm, roi });
  const structuredNote = generateStructuredNote({ riskForm, classification: classifierRun.result, concernOutput, checklist: preventionChecklist });

  const timestamp = new Date().toISOString();

  const output = analysisOutputSchema.parse({
      meta: {
        encounter_id: input.caseId,
        patient_id: input.patientId,
        wound_id: input.woundId,
        demo_mode: Boolean(input.demoCaseId),
        model_name: classifierRun.modelName,
        timestamp,
        warnings: classifierRun.warnings
      },
      roi,
      classification: classifierRun.result,
      concern_output: concernOutput,
      risk_form: riskForm,
      wound_metrics: {
        ai_estimated: {
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
          severity_score: null
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
          severity_score: null
        },
        depth_guidance: "Depth cannot be inferred from a single 2D image.",
        structured_measurements: {
          ai_estimated: {},
          clinician_entered: {}
        }
      },
      prevention_checklist: preventionChecklist,
      structured_note: structuredNote
    });

  return {
    imagePath: input.imagePath,
    riskForm,
    output
  };
}
