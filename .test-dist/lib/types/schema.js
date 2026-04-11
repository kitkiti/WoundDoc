"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.severityAssessmentSchema = exports.clinicianSeverityReviewSchema = exports.severityLevelSchema = exports.caseRecordSchema = exports.caseProgressionSchema = exports.progressionStatusSchema = exports.encounterTimelineEntrySchema = exports.patientRecordSchema = exports.woundRecordSchema = exports.encounterRecordSchema = exports.reviewStateSchema = exports.analysisOutputSchema = exports.auditTrailSchema = exports.auditMetricSourceSchema = exports.modelEvaluationSchema = exports.evaluationCriterionSchema = exports.inferenceOutputSchema = exports.longitudinalAlertSchema = exports.concernOutputSchema = exports.classificationResultSchema = exports.roiResultSchema = exports.checklistItemSchema = exports.metricAssessmentSchema = exports.structuredMeasurementSetSchema = exports.measurementValueSchema = exports.confidenceBandSchema = exports.tissueCompositionSchema = exports.riskFormSchema = exports.captureContextSchema = exports.uploadRecordSchema = exports.captureReferenceTypeValues = void 0;
exports.createEmptyClinicianSeverityReview = createEmptyClinicianSeverityReview;
exports.createDefaultAuditTrail = createDefaultAuditTrail;
const zod_1 = require("zod");
const isoDateTimeSchema = zod_1.z.string().datetime({ offset: true });
exports.captureReferenceTypeValues = [
    "none",
    "ruler",
    "marker",
    "color_card",
    "other"
];
exports.uploadRecordSchema = zod_1.z.object({
    stored_name: zod_1.z.string(),
    original_name: zod_1.z.string(),
    mime_type: zod_1.z.string(),
    size: zod_1.z.number().nonnegative(),
    image_url: zod_1.z.string(),
    file_path: zod_1.z.string(),
    source: zod_1.z.enum(["upload", "demo"]),
    width: zod_1.z.number().int().positive().optional(),
    height: zod_1.z.number().int().positive().optional()
});
exports.captureContextSchema = zod_1.z.object({
    reference_visible: zod_1.z.boolean().default(false),
    reference_type: zod_1.z.enum(exports.captureReferenceTypeValues).default("none"),
    reference_length_cm: zod_1.z.number().nullable().default(null),
    reference_length_px: zod_1.z.number().nullable().default(null),
    pixels_per_cm: zod_1.z.number().nullable().default(null),
    calibration_status: zod_1.z
        .enum(["not_calibrated", "calibrated", "manual_override", "invalid_reference"])
        .default("not_calibrated"),
    notes: zod_1.z.string().default("")
});
exports.riskFormSchema = zod_1.z.object({
    body_site: zod_1.z.string().default(""),
    mobility_limited: zod_1.z.boolean().default(false),
    moisture_issue: zod_1.z.boolean().default(false),
    nutrition_risk: zod_1.z.boolean().default(false),
    device_present: zod_1.z.boolean().default(false),
    previous_pressure_injury: zod_1.z.boolean().default(false),
    support_surface_in_use: zod_1.z.boolean().default(false),
    formal_risk_score: zod_1.z.number().nullable().default(null),
    clinician_severity_score: zod_1.z.number().min(0).max(10).nullable().default(null),
    clinician_confirmation_status: zod_1.z
        .enum(["pending", "confirmed", "needs_review"])
        .default("pending"),
    clinician_confirmation_note: zod_1.z.string().default(""),
    comments: zod_1.z.string().default("")
});
exports.tissueCompositionSchema = zod_1.z
    .object({
    granulation: zod_1.z.number().min(0).max(100).nullable().optional(),
    slough: zod_1.z.number().min(0).max(100).nullable().optional(),
    eschar: zod_1.z.number().min(0).max(100).nullable().optional(),
    epithelial: zod_1.z.number().min(0).max(100).nullable().optional()
})
    .nullable();
exports.confidenceBandSchema = zod_1.z.enum([
    "very_low",
    "low",
    "moderate",
    "high",
    "very_high",
    "unknown"
]);
exports.measurementValueSchema = zod_1.z.object({
    value: zod_1.z.number().nullable().default(null),
    unit: zod_1.z.enum(["px", "cm", "cm2", "percent", "score", "none"]).default("none"),
    source: zod_1.z.enum(["ai", "clinician", "derived", "unknown"]).default("unknown"),
    confidence: exports.confidenceBandSchema.default("unknown"),
    method: zod_1.z.string().default("unspecified"),
    requires_confirmation: zod_1.z.boolean().default(false),
    note: zod_1.z.string().default("")
});
exports.structuredMeasurementSetSchema = zod_1.z.object({
    area: exports.measurementValueSchema.default({}),
    length: exports.measurementValueSchema.default({}),
    width: exports.measurementValueSchema.default({}),
    perimeter: exports.measurementValueSchema.default({}),
    depth: exports.measurementValueSchema.default({}),
    tunneling: exports.measurementValueSchema.default({}),
    undermining: exports.measurementValueSchema.default({}),
    shape_regularity: exports.measurementValueSchema.default({}),
    severity: exports.measurementValueSchema.default({}),
    image_quality: exports.measurementValueSchema.default({})
});
exports.metricAssessmentSchema = zod_1.z.object({
    area_px: zod_1.z.number().nullable().default(null),
    area_cm2: zod_1.z.number().nullable().default(null),
    length_cm: zod_1.z.number().nullable().default(null),
    width_cm: zod_1.z.number().nullable().default(null),
    perimeter_cm: zod_1.z.number().nullable().default(null),
    depth_cm: zod_1.z.number().nullable().default(null),
    shape_regularity_score: zod_1.z.number().nullable().default(null),
    tissue_composition: exports.tissueCompositionSchema.default(null),
    periwound_findings: zod_1.z.array(zod_1.z.string()).default([]),
    exudate_estimate: zod_1.z.string().nullable().default(null),
    image_quality_score: zod_1.z.number().nullable().default(null),
    measurement_confidence: zod_1.z.string().nullable().default(null),
    severity_score: zod_1.z.number().nullable().default(null)
});
exports.checklistItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    rationale: zod_1.z.string(),
    priority: zod_1.z.string(),
    status: zod_1.z.string(),
    selected: zod_1.z.boolean().default(true),
    clinician_note: zod_1.z.string().default("")
});
exports.roiResultSchema = zod_1.z.object({
    found: zod_1.z.boolean(),
    bbox: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]).nullable().optional(),
    mask_bbox: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]).nullable().optional(),
    contour_points: zod_1.z.number().int().nonnegative().optional(),
    mask_area_px: zod_1.z.number().nonnegative().nullable().optional(),
    mask_coverage_ratio: zod_1.z.number().min(0).max(1).nullable().optional(),
    perimeter_px: zod_1.z.number().nonnegative().nullable().optional(),
    segmentation_method: zod_1.z.string().default("intensity_component_v1"),
    crop_dimensions: zod_1.z
        .object({
        width: zod_1.z.number().int().positive(),
        height: zod_1.z.number().int().positive()
    })
        .nullable()
        .optional(),
    quality_flags: zod_1.z.array(zod_1.z.string()).default([]),
    crop_url: zod_1.z.string(),
    overlay_url: zod_1.z.string(),
    mask_url: zod_1.z.string().optional()
});
exports.classificationResultSchema = zod_1.z.object({
    top_class: zod_1.z.string(),
    top_probability: zod_1.z.number(),
    pressure_injury_probability: zod_1.z.number(),
    class_probabilities: zod_1.z.record(zod_1.z.number()),
    adapter_name: zod_1.z.string().optional(),
    model_version: zod_1.z.string().optional(),
    calibrated: zod_1.z.boolean().optional(),
    uncertainty_reasons: zod_1.z.array(zod_1.z.string()).default([]),
    secondary_findings: zod_1.z.array(zod_1.z.string()).default([])
});
exports.concernOutputSchema = zod_1.z.object({
    label: zod_1.z.string(),
    confidence: exports.confidenceBandSchema.or(zod_1.z.string()),
    confidence_text: zod_1.z.string(),
    note: zod_1.z.string(),
    stage_suspicion: zod_1.z.string().default("not assigned"),
    escalation_level: zod_1.z.enum(["routine", "watch", "urgent", "critical"]).default("routine"),
    supporting_signals: zod_1.z.array(zod_1.z.string()).default([])
});
exports.longitudinalAlertSchema = zod_1.z.object({
    id: zod_1.z.string(),
    level: zod_1.z.enum(["info", "watch", "urgent"]),
    title: zod_1.z.string(),
    detail: zod_1.z.string(),
    action: zod_1.z.string().default("")
});
exports.inferenceOutputSchema = zod_1.z.object({
    adapter_name: zod_1.z.string(),
    adapter_version: zod_1.z.string().default("unknown"),
    model_name: zod_1.z.string(),
    model_version: zod_1.z.string().default("unknown"),
    inference_id: zod_1.z.string().default(""),
    latency_ms: zod_1.z.number().int().nonnegative().nullable().default(null),
    uncertainty: zod_1.z.object({
        score: zod_1.z.number().min(0).max(1).nullable().default(null),
        confidence_band: exports.confidenceBandSchema.default("unknown"),
        reasons: zod_1.z.array(zod_1.z.string()).default([])
    }),
    outputs: zod_1.z.object({
        segmentation_available: zod_1.z.boolean().default(false),
        measurements_available: zod_1.z.boolean().default(false),
        severity_available: zod_1.z.boolean().default(false),
        progression_available: zod_1.z.boolean().default(false)
    }),
    raw_outputs: zod_1.z.record(zod_1.z.unknown()).default({})
});
exports.evaluationCriterionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    label: zod_1.z.string(),
    value: zod_1.z.number().nullable().default(null),
    unit: zod_1.z.enum(["ratio", "percent", "score", "none"]).default("none"),
    target: zod_1.z.string().default(""),
    status: zod_1.z.enum(["pass", "watch", "fail"]).default("watch"),
    note: zod_1.z.string().default("")
});
exports.modelEvaluationSchema = zod_1.z.object({
    ready_for_deployment: zod_1.z.boolean().default(false),
    overall_status: zod_1.z.enum(["pass", "watch", "fail"]).default("watch"),
    confidence_gate: exports.confidenceBandSchema.default("unknown"),
    criteria: zod_1.z.array(exports.evaluationCriterionSchema).default([]),
    generated_at: isoDateTimeSchema
});
exports.auditMetricSourceSchema = zod_1.z.object({
    metric: zod_1.z.string(),
    source: zod_1.z.enum(["ai", "clinician", "derived", "unknown"]).default("unknown"),
    confidence: exports.confidenceBandSchema.default("unknown"),
    requires_confirmation: zod_1.z.boolean().default(true),
    uncertainty_reason: zod_1.z.string().default("")
});
exports.auditTrailSchema = zod_1.z.object({
    model_version: zod_1.z.string().default("unknown"),
    inference_id: zod_1.z.string().default(""),
    generated_at: isoDateTimeSchema,
    clinician_override: zod_1.z.boolean().default(false),
    override_fields: zod_1.z.array(zod_1.z.string()).default([]),
    metric_sources: zod_1.z.array(exports.auditMetricSourceSchema).default([])
});
exports.analysisOutputSchema = zod_1.z.object({
    meta: zod_1.z.object({
        encounter_id: zod_1.z.string(),
        patient_id: zod_1.z.string(),
        wound_id: zod_1.z.string(),
        demo_mode: zod_1.z.boolean(),
        model_name: zod_1.z.string(),
        timestamp: isoDateTimeSchema,
        warnings: zod_1.z.array(zod_1.z.string()).default([])
    }),
    roi: exports.roiResultSchema,
    classification: exports.classificationResultSchema,
    inference: exports.inferenceOutputSchema.optional(),
    evaluation: exports.modelEvaluationSchema.optional(),
    audit: exports.auditTrailSchema.optional(),
    concern_output: exports.concernOutputSchema,
    risk_form: exports.riskFormSchema,
    wound_metrics: zod_1.z.object({
        ai_estimated: exports.metricAssessmentSchema,
        clinician_entered: exports.metricAssessmentSchema,
        depth_guidance: zod_1.z.string(),
        structured_measurements: zod_1.z.object({
            ai_estimated: exports.structuredMeasurementSetSchema.default({}),
            clinician_entered: exports.structuredMeasurementSetSchema.default({})
        })
    }),
    longitudinal_alerts: zod_1.z.array(exports.longitudinalAlertSchema).default([]),
    prevention_checklist: zod_1.z.array(exports.checklistItemSchema),
    structured_note: zod_1.z.object({
        summary: zod_1.z.string(),
        full_note: zod_1.z.string(),
        copilot_statement: zod_1.z.string()
    })
});
exports.reviewStateSchema = zod_1.z.object({
    note_text: zod_1.z.string(),
    checklist: zod_1.z.array(exports.checklistItemSchema),
    clinician_acknowledged: zod_1.z.boolean(),
    clinician_wound_assessment: exports.metricAssessmentSchema
});
exports.encounterRecordSchema = zod_1.z.object({
    encounter_id: zod_1.z.string(),
    patient_id: zod_1.z.string(),
    wound_id: zod_1.z.string(),
    demo_case_id: zod_1.z.string().nullable().default(null),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    upload: exports.uploadRecordSchema.optional(),
    capture_context: exports.captureContextSchema.optional(),
    risk_form: exports.riskFormSchema.optional(),
    analysis: exports.analysisOutputSchema.optional(),
    review: exports.reviewStateSchema.optional(),
    export_paths: zod_1.z
        .object({
        json_path: zod_1.z.string(),
        note_path: zod_1.z.string()
    })
        .optional()
});
exports.woundRecordSchema = zod_1.z.object({
    wound_id: zod_1.z.string(),
    patient_id: zod_1.z.string(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    label: zod_1.z.string(),
    body_site: zod_1.z.string().nullable().optional(),
    encounter_ids: zod_1.z.array(zod_1.z.string()).default([]),
    current_encounter_id: zod_1.z.string().nullable().default(null)
});
exports.patientRecordSchema = zod_1.z.object({
    patient_id: zod_1.z.string(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    label: zod_1.z.string(),
    wound_ids: zod_1.z.array(zod_1.z.string()).default([])
});
exports.encounterTimelineEntrySchema = zod_1.z.object({
    encounter_id: zod_1.z.string(),
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema,
    has_analysis: zod_1.z.boolean(),
    has_review: zod_1.z.boolean()
});
exports.progressionStatusSchema = zod_1.z.enum([
    "improving",
    "stable",
    "worsening",
    "insufficient_data"
]);
exports.caseProgressionSchema = zod_1.z.object({
    available: zod_1.z.boolean().default(false),
    status: exports.progressionStatusSchema.default("insufficient_data"),
    summary: zod_1.z.string().default(""),
    days_since_previous: zod_1.z.number().int().nonnegative().nullable().default(null),
    compared_encounter_id: zod_1.z.string().nullable().default(null),
    evaluated_metrics: zod_1.z.array(zod_1.z.string()).default([]),
    metric_deltas: zod_1.z
        .array(zod_1.z.object({
        key: zod_1.z.string(),
        label: zod_1.z.string(),
        current_value: zod_1.z.number(),
        previous_value: zod_1.z.number(),
        delta_percent: zod_1.z.number(),
        status: zod_1.z.enum(["improving", "stable", "worsening"])
    }))
        .default([])
});
exports.caseRecordSchema = zod_1.z.object({
    patient: exports.patientRecordSchema,
    wound: exports.woundRecordSchema,
    encounter: exports.encounterRecordSchema,
    timeline: zod_1.z.array(exports.encounterTimelineEntrySchema),
    progression: exports.caseProgressionSchema
});
exports.severityLevelSchema = zod_1.z.enum(["low", "moderate", "high", "critical"]);
exports.clinicianSeverityReviewSchema = zod_1.z.object({
    status: zod_1.z.enum(["pending", "confirmed", "overridden"]).default("pending"),
    score: zod_1.z.number().min(0).max(100).nullable().default(null),
    level: exports.severityLevelSchema.nullable().default(null),
    summary: zod_1.z.string().default(""),
    confidence: exports.confidenceBandSchema.nullable().default(null)
});
exports.severityAssessmentSchema = zod_1.z.object({
    ai_estimated: zod_1.z.object({
        score: zod_1.z.number().min(0).max(100).nullable().default(null),
        level: exports.severityLevelSchema.nullable().default(null),
        confidence: exports.confidenceBandSchema.nullable().default(null),
        summary: zod_1.z.string().default(""),
        supporting_signals: zod_1.z.array(zod_1.z.string()).default([]),
        uncertainty_reasons: zod_1.z.array(zod_1.z.string()).default([]),
        components: zod_1.z.record(zod_1.z.number()).default({})
    }),
    clinician_review: exports.clinicianSeverityReviewSchema.default({})
});
function createEmptyClinicianSeverityReview() {
    return exports.clinicianSeverityReviewSchema.parse({});
}
function createDefaultAuditTrail() {
    return exports.auditTrailSchema.parse({
        generated_at: new Date().toISOString()
    });
}
