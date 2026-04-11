"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeReferenceType = normalizeReferenceType;
exports.parseCaptureContext = parseCaptureContext;
const schema_1 = require("../types/schema");
const validReferenceTypes = new Set(schema_1.captureReferenceTypeValues);
function toBoolean(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string")
        return value.toLowerCase() === "true";
    return false;
}
function toNullableNumber(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
        if (!value.trim())
            return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function normalizeReferenceType(value) {
    if (typeof value !== "string") {
        return "none";
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "calibration_card") {
        return "color_card";
    }
    if (validReferenceTypes.has(normalized)) {
        return normalized;
    }
    return normalized === "none" ? "none" : "other";
}
function parseCaptureContext(input) {
    const obj = (input ?? {});
    const parsed = {
        reference_visible: toBoolean(obj.reference_visible),
        reference_type: normalizeReferenceType(obj.reference_type),
        reference_length_cm: toNullableNumber(obj.reference_length_cm),
        reference_length_px: toNullableNumber(obj.reference_length_px),
        pixels_per_cm: toNullableNumber(obj.pixels_per_cm),
        calibration_status: typeof obj.calibration_status === "string" ? obj.calibration_status : "not_calibrated",
        notes: typeof obj.notes === "string" ? obj.notes : ""
    };
    const normalized = schema_1.captureContextSchema.parse(parsed);
    if (normalized.reference_visible &&
        normalized.reference_length_cm &&
        normalized.reference_length_px &&
        normalized.reference_length_cm > 0 &&
        normalized.reference_length_px > 0) {
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
