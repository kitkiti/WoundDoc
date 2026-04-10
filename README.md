# WoundWatch

WoundWatch is a demo-ready, mobile-first web application for longitudinal wound monitoring. It is designed for clinician review workflows, separates AI-estimated values from clinician-entered assessment data, and explicitly does not diagnose.

Core flow:

`Landing -> Upload -> Risk Form -> Analysis -> Results -> Review -> Export`

Safety framing:

- Documentation support only. Not for autonomous diagnosis.
- Concern output is non-diagnostic and can return `unable_to_determine`.
- Structured notes and prevention checklists are drafts for clinician review.

## What is included

- Next.js 14 + React + TypeScript + Tailwind CSS web app
- Mobile-first card UI that feels like a browser-based mobile app
- Upload or camera-capture style flow
- Patient -> wound -> encounter storage model for repeat wound tracking
- ROI localization with a practical image-processing fallback
- Swappable classifier adapter layer
- Deterministic demo classifier fallback when a real model is unavailable
- Structured `wound_metrics` block with AI-estimated and clinician-entered values
- Prevention checklist generation from image output + risk form
- Editable structured nursing note draft
- Copy/download export for note text and structured JSON
- Three sample demo cases, including one uncertain case

## Local setup

Requirements:

- Node.js `18.18+`
- npm

Install and run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

Production build check:

```bash
npm run build
```

Full verification used in this repo:

```bash
npm run verify
```

## Demo mode

Demo mode is enabled by default through `.env.example`.

```env
WOUNDDOC_MODEL_PROVIDER=demo
WOUNDDOC_FORCE_DEMO=true
```

In demo mode:

- the app still runs end to end even without a real model
- classifier output is deterministic for the same image + risk form
- the UI shows a demo mode badge
- API responses mark `meta.demo_mode=true`

One-click demo cases are available on the landing page:

- `Heel shear concern`
- `Sacral uncertain review`
- `Device pressure review`

## Where to plug in a real wound model

The classifier integration point is:

- [lib/services/classifier-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/classifier-service.ts)

Current adapter behavior:

- `DemoClassifierAdapter`: always available, deterministic fallback
- `ExternalScriptClassifierAdapter`: runs an external script and parses JSON output

To connect a real pretrained classifier:

1. Set `WOUNDDOC_FORCE_DEMO=false`
2. Set `WOUNDDOC_MODEL_PROVIDER=script`
3. Point `WOUNDDOC_MODEL_SCRIPT` at your Python or executable adapter
4. Return the expected JSON schema from that adapter

Environment variables:

```env
WOUNDDOC_MODEL_PROVIDER=script
WOUNDDOC_FORCE_DEMO=false
WOUNDDOC_MODEL_NAME=my-wound-model
WOUNDDOC_MODEL_SCRIPT=./scripts/external-classifier-adapter.example.py
WOUNDDOC_EXTERNAL_PYTHON=python3
WOUNDDOC_MODEL_TIMEOUT_MS=6000
WOUNDDOC_LOG_LEVEL=debug
```

Example adapter contract:

- [scripts/external-classifier-adapter.example.py](/home/syed-naveed-mahmood/wounddoc/WoundDoc/scripts/external-classifier-adapter.example.py)

The external adapter receives JSON on `stdin`:

```json
{
  "image_path": "/abs/path/to/image.png",
  "bbox": [100, 120, 420, 520],
  "risk_form": {
    "body_site": "Sacrum",
    "mobility_limited": true
  }
}
```

It must print JSON to `stdout`:

```json
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
  "adapter_name": "my-wound-model"
}
```

## API endpoints

- `POST /api/upload`
- `POST /api/analyze-roi`
- `POST /api/classify`
- `POST /api/generate-checklist`
- `POST /api/generate-note`
- `POST /api/full-pipeline`
- `GET /api/demo-case/:id`

## Project structure

```text
app/
  api/                         Next.js route handlers
  cases/[caseId]/...           Mobile workflow screens
components/                    Reusable UI building blocks
lib/
  client/                      Browser draft persistence
  demo/                        Demo wound presets
  server/                      Storage, logging, path helpers
  services/                    roi / classifier / checklist / note services
  types/                       Zod schemas and TS types
public/demo/                   Demo images
uploads/                       Temporary uploaded images and ROI assets
data/patients/                 Patient records
data/wounds/                   Wound records with encounter timelines
data/encounters/               Saved encounter records
data/outputs/                  Exported JSON and note text
scripts/                       Demo asset generation and model adapter example
```

Important service files:

- [lib/services/roi-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/roi-service.ts)
- [lib/services/classifier-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/classifier-service.ts)
- [lib/services/risk-form-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/risk-form-service.ts)
- [lib/services/checklist-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/checklist-service.ts)
- [lib/services/note-generator-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/note-generator-service.ts)
- [lib/services/export-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/export-service.ts)
- [lib/services/full-pipeline-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/full-pipeline-service.ts)

## Data handling

- Uploaded images are saved temporarily under `uploads/<encounterId>/`
- Patient records are saved to `data/patients/<patientId>.json`
- Wound records are saved to `data/wounds/<woundId>.json`
- Encounter records are saved to `data/encounters/<encounterId>.json`
- Reviewed exports are saved to:
  - `data/outputs/<encounterId>.json`
  - `data/outputs/<encounterId>.txt`

The export screen also supports:

- copy note text
- copy structured JSON
- download note text
- download structured JSON

## Output schema

`/api/full-pipeline` returns:

```json
{
  "meta": {
    "encounter_id": "encounter-123",
    "patient_id": "patient-123",
    "wound_id": "wound-123",
    "demo_mode": true,
    "model_name": "demo-deterministic-v1",
    "timestamp": "2026-04-10T12:00:00.000Z",
    "warnings": ["Demo classifier adapter in use."]
  },
  "roi": {
    "found": true,
    "bbox": [120, 140, 520, 560],
    "quality_flags": [],
    "crop_url": "/api/files/uploads/encounter-123/roi-crop.png",
    "overlay_url": "/api/files/uploads/encounter-123/roi-overlay.png"
  },
  "classification": {
    "top_class": "pressure_injury",
    "top_probability": 0.79,
    "pressure_injury_probability": 0.79,
    "class_probabilities": {
      "pressure_injury": 0.79,
      "diabetic_ulcer": 0.05,
      "venous_ulcer": 0.04,
      "surgical_wound": 0.03,
      "intact_skin": 0.09
    }
  },
  "wound_metrics": {
    "ai_estimated": {
      "area_px": 168000,
      "area_cm2": null,
      "length_cm": null,
      "width_cm": null,
      "perimeter_cm": null,
      "tissue_composition": null,
      "periwound_findings": ["moisture-associated skin stress risk"],
      "exudate_estimate": "manual confirmation required",
      "image_quality_score": 82,
      "measurement_confidence": "moderate",
      "severity_score": 71
    },
    "clinician_entered": {
      "area_px": null,
      "area_cm2": 6.4,
      "length_cm": 3.2,
      "width_cm": 2.1,
      "perimeter_cm": null,
      "tissue_composition": null,
      "periwound_findings": ["mild periwound erythema"],
      "exudate_estimate": "scant serous drainage",
      "image_quality_score": null,
      "measurement_confidence": null,
      "severity_score": 65
    }
  },
  "concern_output": {
    "label": "stage_suspicion",
    "confidence": "moderate",
    "note": "Possible superficial pressure-injury pattern. This is a non-diagnostic stage suspicion for clinician review."
  }
}
```

## Notes for demo use

- The app is web-only. There is no Flutter, React Native, Android, or iOS code.
- The UI is optimized for phone-sized browser viewports first.
- Demo images are generated locally by `scripts/generate-demo-assets.mjs`.
- The formal risk score logic assumes a Braden-like scale where lower scores imply higher risk.

## Current status

This repository contains a working end-to-end demo:

- upload image
- fill risk form
- run full pipeline
- review ROI and probability outputs
- edit note and checklist
- export/copy outputs
