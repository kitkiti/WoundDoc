import { z } from "zod";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const uploadRecordSchema = z.object({
  stored_name: z.string(),
  original_name: z.string(),
  mime_type: z.string(),
  size: z.number().nonnegative(),
  image_url: z.string(),
  file_path: z.string(),
  source: z.enum(["upload", "demo"]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export const captureContextSchema = z.object({
  reference_visible: z.boolean().default(false),
  reference_type: z.enum(["none", "ruler", "calibration_card", "other"]).default("none"),
  reference_length_cm: z.number().nullable().default(null),
  reference_length_px: z.number().nullable().default(null),
  pixels_per_cm: z.number().nullable().default(null),
  calibration_status: z
    .enum(["not_calibrated", "calibrated", "manual_override", "invalid_reference"])
    .default("not_calibrated"),
  notes: z.string().default("")
});

export const riskFormSchema = z.object({
  body_site: z.string().default(""),
  mobility_limited: z.boolean().default(false),
  moisture_issue: z.boolean().default(false),
  nutrition_risk: z.boolean().default(false),
  device_present: z.boolean().default(false),
  previous_pressure_injury: z.boolean().default(false),
  support_surface_in_use: z.boolean().default(false),
  formal_risk_score: z.number().nullable().default(null),
  comments: z.string().default("")
});

export const tissueCompositionSchema = z
  .object({
    granulation: z.number().min(0).max(100).nullable().optional(),
    slough: z.number().min(0).max(100).nullable().optional(),
    eschar: z.number().min(0).max(100).nullable().optional(),
    epithelial: z.number().min(0).max(100).nullable().optional()
  })
  .nullable();

export const metricAssessmentSchema = z.object({
  area_px: z.number().nullable().default(null),
  area_cm2: z.number().nullable().default(null),
  length_cm: z.number().nullable().default(null),
  width_cm: z.number().nullable().default(null),
  perimeter_cm: z.number().nullable().default(null),
  depth_cm: z.number().nullable().default(null),
  shape_regularity_score: z.number().nullable().default(null),
  tissue_composition: tissueCompositionSchema.default(null),
  periwound_findings: z.array(z.string()).default([]),
  exudate_estimate: z.string().nullable().default(null),
  image_quality_score: z.number().nullable().default(null),
  measurement_confidence: z.string().nullable().default(null),
  severity_score: z.number().nullable().default(null)
});

export const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  priority: z.string(),
  status: z.string(),
  selected: z.boolean().default(true),
  clinician_note: z.string().default("")
});

export const roiResultSchema = z.object({
  found: z.boolean(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
  mask_bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
  quality_flags: z.array(z.string()).default([]),
  crop_url: z.string(),
  overlay_url: z.string(),
  mask_url: z.string().optional()
});

export const classificationResultSchema = z.object({
  top_class: z.string(),
  top_probability: z.number(),
  pressure_injury_probability: z.number(),
  class_probabilities: z.record(z.number()),
  adapter_name: z.string().optional()
});

export const concernOutputSchema = z.object({
  label: z.string(),
  confidence: z.string(),
  confidence_text: z.string(),
  note: z.string(),
  stage_suspicion: z.string().default("not assigned")
});

export const analysisOutputSchema = z.object({
  meta: z.object({
    encounter_id: z.string(),
    patient_id: z.string(),
    wound_id: z.string(),
    demo_mode: z.boolean(),
    model_name: z.string(),
    timestamp: isoDateTimeSchema,
    warnings: z.array(z.string()).default([])
  }),
  roi: roiResultSchema,
  classification: classificationResultSchema,
  concern_output: concernOutputSchema,
  risk_form: riskFormSchema,
  wound_metrics: z.object({
    ai_estimated: metricAssessmentSchema,
    clinician_entered: metricAssessmentSchema,
    depth_guidance: z.string()
  }),
  prevention_checklist: z.array(checklistItemSchema),
  structured_note: z.object({
    summary: z.string(),
    full_note: z.string(),
    copilot_statement: z.string()
  })
});

export const reviewStateSchema = z.object({
  note_text: z.string(),
  checklist: z.array(checklistItemSchema),
  clinician_acknowledged: z.boolean(),
  clinician_wound_assessment: metricAssessmentSchema
});

export const encounterRecordSchema = z.object({
  encounter_id: z.string(),
  patient_id: z.string(),
  wound_id: z.string(),
  demo_case_id: z.string().nullable().default(null),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  upload: uploadRecordSchema.optional(),
  capture_context: captureContextSchema.optional(),
  risk_form: riskFormSchema.optional(),
  analysis: analysisOutputSchema.optional(),
  review: reviewStateSchema.optional(),
  export_paths: z
    .object({
      json_path: z.string(),
      note_path: z.string()
    })
    .optional()
});

export const woundRecordSchema = z.object({
  wound_id: z.string(),
  patient_id: z.string(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  label: z.string(),
  body_site: z.string().nullable().optional(),
  encounter_ids: z.array(z.string()).default([]),
  current_encounter_id: z.string().nullable().default(null)
});

export const patientRecordSchema = z.object({
  patient_id: z.string(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  label: z.string(),
  wound_ids: z.array(z.string()).default([])
});

export const encounterTimelineEntrySchema = z.object({
  encounter_id: z.string(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
  has_analysis: z.boolean(),
  has_review: z.boolean()
});

export const caseRecordSchema = z.object({
  patient: patientRecordSchema,
  wound: woundRecordSchema,
  encounter: encounterRecordSchema,
  timeline: z.array(encounterTimelineEntrySchema)
});

export type UploadRecord = z.infer<typeof uploadRecordSchema>;
export type CaptureContext = z.infer<typeof captureContextSchema>;
export type RiskForm = z.infer<typeof riskFormSchema>;
export type TissueComposition = z.infer<typeof tissueCompositionSchema>;
export type MetricAssessment = z.infer<typeof metricAssessmentSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type EncounterRecord = z.infer<typeof encounterRecordSchema>;
export type WoundRecord = z.infer<typeof woundRecordSchema>;
export type PatientRecord = z.infer<typeof patientRecordSchema>;
export type CaseRecord = z.infer<typeof caseRecordSchema>;
