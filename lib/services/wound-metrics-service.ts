import Jimp from "jimp";
import { clamp, round } from "@/lib/utils";
import {
  type CaptureContext,
  type ClassificationResult,
  type ConfidenceLevel,
  type MetricAssessment,
  type RiskForm,
  type ROIResult,
  type TissueComposition,
  type WoundMetrics
} from "@/lib/types/schema";

type WoundMetricsInput = {
  classification: ClassificationResult;
  imagePath: string;
  captureContext?: CaptureContext;
  riskForm: RiskForm;
  roi: ROIResult;
};

const qualityPenaltyByFlag = {
  low_contrast: 18,
  small_roi: 12,
  large_roi: 10,
  limited_color_signal: 14,
  fallback_bbox_used: 18,
  possible_motion_blur: 16,
  image_too_dark: 20
} as const;

function getPixel(image: Jimp, x: number, y: number) {
  const index = (image.bitmap.width * y + x) * 4;
  const data = image.bitmap.data;

  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
    a: data[index + 3] ?? 255
  };
}

function getImageQualityScore(roi: ROIResult) {
  return Math.max(
    18,
    100 -
      roi.quality_flags.reduce(
        (sum, flag) => sum + (qualityPenaltyByFlag[flag] ?? 10),
        0
      )
  );
}

function getMeasurementConfidence(
  roi: ROIResult,
  imageQualityScore: number,
  captureContext?: CaptureContext
): ConfidenceLevel {
  if (
    roi.quality_flags.includes("fallback_bbox_used") ||
    roi.quality_flags.includes("possible_motion_blur") ||
    roi.quality_flags.includes("image_too_dark")
  ) {
    return "low";
  }

  if (captureContext?.pixels_per_cm && imageQualityScore >= 84) {
    return "high";
  }

  if (imageQualityScore >= 72) {
    return "moderate";
  }

  return "low";
}

function normalizeTissueComposition(counts: Record<keyof TissueComposition, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return null;
  }

  return {
    granulation: round((counts.granulation / total) * 100, 0),
    slough: round((counts.slough / total) * 100, 0),
    eschar: round((counts.eschar / total) * 100, 0),
    epithelial: round((counts.epithelial / total) * 100, 0)
  };
}

function getShapeRegularityScore(areaPx: number | null, perimeterPx: number | null) {
  if (!areaPx || !perimeterPx || perimeterPx <= 0) {
    return null;
  }

  return round(clamp((4 * Math.PI * areaPx) / (perimeterPx * perimeterPx), 0, 1) * 100, 0);
}

function getSeverityScore(
  classification: ClassificationResult,
  riskForm: RiskForm,
  imageQualityScore: number,
  tissueComposition: TissueComposition | null
) {
  const riskSignalCount = [
    riskForm.mobility_limited,
    riskForm.moisture_issue,
    riskForm.nutrition_risk,
    riskForm.device_present,
    riskForm.previous_pressure_injury,
    !riskForm.support_surface_in_use
  ].filter(Boolean).length;

  const tissueBurden =
    (tissueComposition?.slough ?? 0) * 0.16 + (tissueComposition?.eschar ?? 0) * 0.24;

  return Math.round(
    clamp(
      classification.pressure_injury_probability * 62 +
        riskSignalCount * 6 +
        tissueBurden +
        (riskForm.formal_risk_score !== null ? (20 - riskForm.formal_risk_score) * 0.55 : 0) +
        (imageQualityScore - 60) * 0.14,
      0,
      100
    )
  );
}

function emptyClinicianAssessment(): MetricAssessment {
  return {
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
  };
}

async function deriveImageSignals(imagePath: string, roi: ROIResult) {
  const bbox = roi.mask_bbox ?? roi.bbox;

  if (!bbox) {
    return {
      tissueComposition: null as TissueComposition | null,
      periwoundFindings: ["surrounding skin findings could not be derived"],
      exudateEstimate: "manual confirmation required"
    };
  }

  const image = await Jimp.read(imagePath);
  const cropWidth = Math.max(1, bbox[2] - bbox[0]);
  const cropHeight = Math.max(1, bbox[3] - bbox[1]);
  const crop = image.clone().crop(bbox[0], bbox[1], cropWidth, cropHeight);
  const expandedMarginX = Math.max(8, Math.round(cropWidth * 0.18));
  const expandedMarginY = Math.max(8, Math.round(cropHeight * 0.18));
  const outerX1 = Math.max(0, bbox[0] - expandedMarginX);
  const outerY1 = Math.max(0, bbox[1] - expandedMarginY);
  const outerX2 = Math.min(image.bitmap.width, bbox[2] + expandedMarginX);
  const outerY2 = Math.min(image.bitmap.height, bbox[3] + expandedMarginY);
  const counts: Record<keyof TissueComposition, number> = {
    granulation: 0,
    slough: 0,
    eschar: 0,
    epithelial: 0
  };
  const periwoundFindings: string[] = [];
  const step = Math.max(1, Math.floor(Math.max(cropWidth, cropHeight) / 80));
  let glossSignal = 0;
  let cropSamples = 0;

  for (let y = 0; y < crop.bitmap.height; y += step) {
    for (let x = 0; x < crop.bitmap.width; x += step) {
      const { r, g, b } = getPixel(crop, x, y);
      const brightness = (r + g + b) / 3;
      const maxChannel = Math.max(r, g, b);
      const minChannel = Math.min(r, g, b);
      const saturation = maxChannel - minChannel;
      cropSamples += 1;

      if (brightness < 62) {
        counts.eschar += 1;
      } else if (r > g + 20 && r > b + 24 && saturation > 28) {
        counts.granulation += 1;
      } else if (r > 118 && g > 100 && b < 130) {
        counts.slough += 1;
      } else if (brightness > 178 && saturation < 22) {
        counts.epithelial += 1;
      }

      if (brightness > 190 && saturation < 18) {
        glossSignal += 1;
      }
    }
  }

  let ringRedness = 0;
  let ringBrightness = 0;
  let ringSamples = 0;
  const ringStep = Math.max(1, Math.floor(Math.max(outerX2 - outerX1, outerY2 - outerY1) / 100));

  for (let y = outerY1; y < outerY2; y += ringStep) {
    for (let x = outerX1; x < outerX2; x += ringStep) {
      const insideBbox = x >= bbox[0] && x < bbox[2] && y >= bbox[1] && y < bbox[3];

      if (insideBbox) {
        continue;
      }

      const { r, g, b } = getPixel(image, x, y);
      ringRedness += r - (g + b) / 2;
      ringBrightness += (r + g + b) / 3;
      ringSamples += 1;
    }
  }

  const tissueComposition = normalizeTissueComposition(counts);
  const meanRingRedness = ringSamples > 0 ? ringRedness / ringSamples : 0;
  const meanRingBrightness = ringSamples > 0 ? ringBrightness / ringSamples : 0;

  if (meanRingRedness > 18) {
    periwoundFindings.push("visible surrounding erythema signal");
  }

  if (meanRingBrightness > 176 && meanRingRedness < 12) {
    periwoundFindings.push("pale surrounding skin signal");
  }

  if (glossSignal / Math.max(cropSamples, 1) > 0.22) {
    periwoundFindings.push("surface moisture or sheen signal");
  }

  return {
    tissueComposition,
    periwoundFindings,
    exudateEstimate:
      glossSignal / Math.max(cropSamples, 1) > 0.22
        ? "surface moisture signal present; manual confirmation required"
        : "no obvious heavy drainage signal; manual confirmation required"
  };
}

function getPeriwoundFindings(
  riskForm: RiskForm,
  roi: ROIResult,
  imageFindings: string[]
) {
  const findings = [...imageFindings];

  if (riskForm.moisture_issue) {
    findings.push("moisture-associated skin stress risk");
  }

  if (riskForm.device_present) {
    findings.push("device-related pressure exposure");
  }

  if (riskForm.mobility_limited) {
    findings.push("sustained pressure risk from limited mobility");
  }

  if (riskForm.previous_pressure_injury) {
    findings.push("history of recurrent breakdown");
  }

  if (
    roi.quality_flags.includes("image_too_dark") ||
    roi.quality_flags.includes("low_contrast")
  ) {
    findings.push("periwound visibility limited");
  }

  return Array.from(new Set(findings));
}

function toCentimeters(valuePx: number | null | undefined, captureContext?: CaptureContext) {
  if (!valuePx || !captureContext?.pixels_per_cm || captureContext.pixels_per_cm <= 0) {
    return null;
  }

  return round(valuePx / captureContext.pixels_per_cm, 2);
}

function toAreaCm2(valuePx: number | null | undefined, captureContext?: CaptureContext) {
  if (!valuePx || !captureContext?.pixels_per_cm || captureContext.pixels_per_cm <= 0) {
    return null;
  }

  return round(valuePx / (captureContext.pixels_per_cm * captureContext.pixels_per_cm), 2);
}

export async function deriveWoundMetrics({
  classification,
  imagePath,
  captureContext,
  riskForm,
  roi
}: WoundMetricsInput): Promise<WoundMetrics> {
  const areaPx =
    roi.mask_area_px ?? (roi.bbox ? (roi.bbox[2] - roi.bbox[0]) * (roi.bbox[3] - roi.bbox[1]) : null);
  const perimeterPx = roi.perimeter_px ?? null;
  const majorAxisPx =
    roi.major_axis_px ??
    (roi.mask_bbox ? roi.mask_bbox[2] - roi.mask_bbox[0] : roi.bbox ? roi.bbox[2] - roi.bbox[0] : null);
  const minorAxisPx =
    roi.minor_axis_px ??
    (roi.mask_bbox ? roi.mask_bbox[3] - roi.mask_bbox[1] : roi.bbox ? roi.bbox[3] - roi.bbox[1] : null);
  const imageQualityScore = getImageQualityScore(roi);
  const measurementConfidence = getMeasurementConfidence(roi, imageQualityScore, captureContext);
  const imageSignals = await deriveImageSignals(imagePath, roi);
  const tissueComposition = imageSignals.tissueComposition;
  const periwoundFindings = getPeriwoundFindings(riskForm, roi, imageSignals.periwoundFindings);
  const severityScore = getSeverityScore(
    classification,
    riskForm,
    imageQualityScore,
    tissueComposition
  );

  return {
    ai_estimated: {
      area_px: areaPx ? round(areaPx, 0) : null,
      area_cm2: toAreaCm2(areaPx, captureContext),
      length_cm: toCentimeters(majorAxisPx, captureContext),
      width_cm: toCentimeters(minorAxisPx, captureContext),
      perimeter_cm: toCentimeters(perimeterPx, captureContext),
      depth_cm: null,
      shape_regularity_score: getShapeRegularityScore(areaPx, perimeterPx),
      tissue_composition: tissueComposition,
      periwound_findings: periwoundFindings,
      exudate_estimate: imageSignals.exudateEstimate,
      image_quality_score: round(imageQualityScore, 0),
      measurement_confidence: measurementConfidence,
      severity_score: severityScore
    },
    clinician_entered: emptyClinicianAssessment(),
    depth_guidance:
      "Depth is not inferable from a single 2D mobile photo. Use clinician-entered depth or a validated calibrated workflow."
  };
}
