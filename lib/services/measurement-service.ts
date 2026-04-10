import type { RoiResult } from "@/lib/types/schema";

export type CalibratedMeasurements = {
  area_px: number | null;
  area_cm2: number | null;
  length_cm: number | null;
  width_cm: number | null;
  perimeter_cm: number | null;
  calibration_applied: boolean;
  measurement_confidence: "low" | "moderate" | "high";
};

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function deriveCalibratedMeasurements(
  roi: RoiResult,
  pixelsPerCm: number | null | undefined
): CalibratedMeasurements {
  const areaPx = roi.mask_area_px ?? null;
  const perimeterPx = roi.perimeter_px ?? null;

  if (!pixelsPerCm || pixelsPerCm <= 0 || !areaPx || !roi.bbox) {
    return {
      area_px: areaPx,
      area_cm2: null,
      length_cm: null,
      width_cm: null,
      perimeter_cm: null,
      calibration_applied: false,
      measurement_confidence: "low"
    };
  }

  const [x1, y1, x2, y2] = roi.bbox;
  const spanX = Math.max(0, x2 - x1 + 1);
  const spanY = Math.max(0, y2 - y1 + 1);
  const lengthPx = Math.max(spanX, spanY);
  const widthPx = Math.min(spanX, spanY);
  const pxPerCm2 = pixelsPerCm * pixelsPerCm;

  const coverage = roi.mask_coverage_ratio ?? 0;
  const confidence = coverage >= 0.05 && coverage <= 0.35 ? "high" : "moderate";

  return {
    area_px: areaPx,
    area_cm2: round(areaPx / pxPerCm2, 2),
    length_cm: round(lengthPx / pixelsPerCm, 2),
    width_cm: round(widthPx / pixelsPerCm, 2),
    perimeter_cm: perimeterPx ? round(perimeterPx / pixelsPerCm, 2) : null,
    calibration_applied: true,
    measurement_confidence: confidence
  };
}
