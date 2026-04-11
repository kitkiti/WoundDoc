export type RoiHint =
  | [number, number, number, number]
  | {
      bbox?: [number, number, number, number] | null;
    }
  | null;

export type SegmentationInferenceInput = {
  imagePath: string;
  promptPhrases: string[];
  roiHint?: RoiHint;
  presetQualityFlags?: string[];
};

export type SegmentationMaskResult = {
  found: boolean;
  bbox: [number, number, number, number] | null;
  maskPixels: number[];
  contourPoints: number;
  areaPx: number | null;
  perimeterPx: number | null;
  coverageRatio: number | null;
  qualityFlags: string[];
  segmentationMethod: string;
  segmentationConfidence: number | null;
  segmentationModelName?: string;
  segmentationModelVersion?: string;
};

export type ClassificationInferenceInput = {
  imagePath: string;
  roi: {
    found: boolean;
    quality_flags: string[];
    mask_coverage_ratio?: number | null;
    segmentation_confidence?: number | null;
  };
  riskForm: {
    mobility_limited: boolean;
    moisture_issue: boolean;
    nutrition_risk: boolean;
    device_present: boolean;
    previous_pressure_injury: boolean;
    support_surface_in_use: boolean;
    formal_risk_score: number | null;
    clinician_severity_score: number | null;
    clinician_confirmation_status: "pending" | "confirmed" | "needs_review";
    body_site: string;
    clinician_confirmation_note: string;
    comments: string;
  };
  demoCaseId?: string;
  classifierOverride?: {
    top_class?: string;
    top_probability?: number;
    pressure_injury_probability?: number;
    class_probabilities?: Record<string, number>;
    uncertainty_reasons?: string[];
    secondary_findings?: string[];
    model_name?: string;
    model_version?: string;
    model_card?: string;
    embedding_reference?: string;
  };
};
