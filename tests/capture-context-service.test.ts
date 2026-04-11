import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReferenceType,
  parseCaptureContext
} from "../lib/services/capture-context-service";

test("normalizeReferenceType maps legacy calibration_card to color_card", () => {
  assert.equal(normalizeReferenceType("calibration_card"), "color_card");
});

test("parseCaptureContext preserves current UI reference types", () => {
  const marker = parseCaptureContext({
    reference_visible: true,
    reference_type: "marker",
    reference_length_cm: "1.5",
    reference_length_px: "90"
  });
  const colorCard = parseCaptureContext({
    reference_visible: true,
    reference_type: "color_card",
    reference_length_cm: "4",
    reference_length_px: "200"
  });

  assert.equal(marker.reference_type, "marker");
  assert.equal(marker.pixels_per_cm, 60);
  assert.equal(marker.calibration_status, "manual_override");
  assert.equal(colorCard.reference_type, "color_card");
  assert.equal(colorCard.pixels_per_cm, 50);
});

test("parseCaptureContext resets hidden references to none", () => {
  const hidden = parseCaptureContext({
    reference_visible: false,
    reference_type: "marker",
    reference_length_cm: "1.5",
    reference_length_px: "90",
    pixels_per_cm: "60"
  });

  assert.deepEqual(hidden, {
    reference_visible: false,
    reference_type: "none",
    reference_length_cm: null,
    reference_length_px: null,
    pixels_per_cm: null,
    calibration_status: "not_calibrated",
    notes: ""
  });
});

test("parseCaptureContext falls back unknown reference types to other", () => {
  const parsed = parseCaptureContext({
    reference_visible: true,
    reference_type: "coin"
  });

  assert.equal(parsed.reference_type, "other");
});
