#!/usr/bin/env python3
"""
Example external classifier adapter for WoundDoc Lite.

The Next.js app writes a JSON payload to stdin:
{
  "image_path": "...",
  "bbox": [x1, y1, x2, y2] | null,
  "risk_form": { ... }
}

The script must print a single JSON object to stdout:
{
  "top_class": "pressure_injury",
  "top_probability": 0.63,
  "pressure_injury_probability": 0.63,
  "class_probabilities": {
    "pressure_injury": 0.63,
    "diabetic_ulcer": 0.08,
    "venous_ulcer": 0.06,
    "surgical_wound": 0.11,
    "intact_skin": 0.12
  },
  "adapter_name": "my-wound-model",
  "model_version": "2026.04.0",
  "uncertainty_reasons": ["example_reason"],
  "secondary_findings": ["example_finding"]
}

Replace `run_model` with real inference code for a wound classifier.
"""

from __future__ import annotations

import hashlib
import json
import sys
from typing import Any


CLASSES = [
    "pressure_injury",
    "diabetic_ulcer",
    "venous_ulcer",
    "surgical_wound",
    "intact_skin",
]


def normalize(scores: dict[str, float]) -> dict[str, float]:
    total = sum(max(value, 0.0) for value in scores.values()) or 1.0
    return {label: round(max(value, 0.0) / total, 4) for label, value in scores.items()}


def run_model(payload: dict[str, Any]) -> dict[str, float]:
    """
    Demo-only deterministic scoring.

    Swap this function with real model loading and inference. A practical integration point is:
    1. Load the image from `payload["image_path"]`
    2. Apply ROI cropping with `payload["bbox"]` if your model expects it
    3. Return normalized class scores across the five expected labels
    """

    seed = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode("utf-8")
    ).digest()

    risk_form = payload.get("risk_form", {})
    mobility = 0.18 if risk_form.get("mobility_limited") else 0.0
    moisture = 0.08 if risk_form.get("moisture_issue") else 0.0
    device = 0.1 if risk_form.get("device_present") else 0.0

    raw_scores = {
        "pressure_injury": 0.28 + seed[0] / 255 * 0.2 + mobility + moisture + device,
        "diabetic_ulcer": 0.08 + seed[1] / 255 * 0.12,
        "venous_ulcer": 0.07 + seed[2] / 255 * 0.1,
        "surgical_wound": 0.09 + seed[3] / 255 * 0.12,
        "intact_skin": 0.12 + seed[4] / 255 * 0.15,
    }
    return normalize(raw_scores)


def main() -> int:
    payload = json.load(sys.stdin)
    probabilities = run_model(payload)
    top_class = max(CLASSES, key=lambda label: probabilities[label])

    response = {
        "top_class": top_class,
        "top_probability": probabilities[top_class],
        "pressure_injury_probability": probabilities["pressure_injury"],
        "class_probabilities": probabilities,
        "adapter_name": "example-python-script",
        "model_version": "2026.04.0",
        "uncertainty_reasons": [],
        "secondary_findings": [],
    }
    json.dump(response, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
