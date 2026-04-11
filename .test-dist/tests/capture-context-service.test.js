"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const capture_context_service_1 = require("../lib/services/capture-context-service");
(0, node_test_1.default)("normalizeReferenceType maps legacy calibration_card to color_card", () => {
    strict_1.default.equal((0, capture_context_service_1.normalizeReferenceType)("calibration_card"), "color_card");
});
(0, node_test_1.default)("parseCaptureContext preserves current UI reference types", () => {
    const marker = (0, capture_context_service_1.parseCaptureContext)({
        reference_visible: true,
        reference_type: "marker",
        reference_length_cm: "1.5",
        reference_length_px: "90"
    });
    const colorCard = (0, capture_context_service_1.parseCaptureContext)({
        reference_visible: true,
        reference_type: "color_card",
        reference_length_cm: "4",
        reference_length_px: "200"
    });
    strict_1.default.equal(marker.reference_type, "marker");
    strict_1.default.equal(marker.pixels_per_cm, 60);
    strict_1.default.equal(marker.calibration_status, "manual_override");
    strict_1.default.equal(colorCard.reference_type, "color_card");
    strict_1.default.equal(colorCard.pixels_per_cm, 50);
});
(0, node_test_1.default)("parseCaptureContext resets hidden references to none", () => {
    const hidden = (0, capture_context_service_1.parseCaptureContext)({
        reference_visible: false,
        reference_type: "marker",
        reference_length_cm: "1.5",
        reference_length_px: "90",
        pixels_per_cm: "60"
    });
    strict_1.default.deepEqual(hidden, {
        reference_visible: false,
        reference_type: "none",
        reference_length_cm: null,
        reference_length_px: null,
        pixels_per_cm: null,
        calibration_status: "not_calibrated",
        notes: ""
    });
});
(0, node_test_1.default)("parseCaptureContext falls back unknown reference types to other", () => {
    const parsed = (0, capture_context_service_1.parseCaptureContext)({
        reference_visible: true,
        reference_type: "coin"
    });
    strict_1.default.equal(parsed.reference_type, "other");
});
