import {
  captureContextSchema,
  captureReferenceTypeValues,
  type CaptureContext
} from "../types/schema";

const validReferenceTypes = new Set<string>(captureReferenceTypeValues);

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeReferenceType(value: unknown): CaptureContext["reference_type"] {
  if (typeof value !== "string") {
    return "none";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "calibration_card") {
    return "color_card";
  }

  if (validReferenceTypes.has(normalized)) {
    return normalized as CaptureContext["reference_type"];
  }

  return normalized === "none" ? "none" : "other";
}

export function parseCaptureContext(input: unknown): CaptureContext {
  const obj = (input ?? {}) as Record<string, unknown>;
  const parsed = {
    reference_visible: toBoolean(obj.reference_visible),
    reference_type: normalizeReferenceType(obj.reference_type),
    reference_length_cm: toNullableNumber(obj.reference_length_cm),
    reference_length_px: toNullableNumber(obj.reference_length_px),
    pixels_per_cm: toNullableNumber(obj.pixels_per_cm),
    calibration_status:
      typeof obj.calibration_status === "string" ? obj.calibration_status : "not_calibrated",
    notes: typeof obj.notes === "string" ? obj.notes : ""
  };

  const normalized = captureContextSchema.parse(parsed);

  if (
    normalized.reference_visible &&
    normalized.reference_length_cm &&
    normalized.reference_length_px &&
    normalized.reference_length_cm > 0 &&
    normalized.reference_length_px > 0
  ) {
    return {
      ...normalized,
      pixels_per_cm: normalized.reference_length_px / normalized.reference_length_cm,
      calibration_status: "manual_override"
    };
  }

  return {
    ...normalized,
    reference_type: normalized.reference_visible ? normalized.reference_type : "none",
    reference_length_cm: normalized.reference_visible ? normalized.reference_length_cm : null,
    reference_length_px: normalized.reference_visible ? normalized.reference_length_px : null,
    pixels_per_cm: normalized.reference_visible ? normalized.pixels_per_cm : null,
    calibration_status: normalized.reference_visible
      ? normalized.calibration_status
      : "not_calibrated"
  };
}
