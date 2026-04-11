# WoundWatch Required Update Plan

## Objective

Turn the current demo into a real wound documentation and progression-tracking system where:

- wound localization is model-backed, not threshold heuristics
- concern estimation is model-backed, not a hand-tuned probability formula
- progression is based on repeat encounters for the same wound, not one-off case IDs
- structured notes and prevention actions are generated from validated wound metrics and longitudinal state
- all core AI runs through real Hugging Face models and fine-tuned wound-specific heads

## Current repo status

The current repo is a demo scaffold, not a finished implementation of the product idea.

- Good:
  - mobile-first workflow exists
  - patient / wound / encounter JSON model exists
  - clinician review flow exists
  - a progression service exists in code
- Not good enough:
  - the main non-demo workflow does not reliably create repeat encounters for the same wound
  - the classifier is not image-based AI; it is a rule-based fusion of ROI-found plus risk flags
  - ROI localization is an image-processing heuristic, not a wound model
  - progression depends on weak proxies such as raw pixel area and heuristic severity
  - checklist and note generation are mostly templates
  - the build currently does not pass cleanly in this workspace

## Non-negotiable product requirements

These must be treated as required, not optional polish.

1. A clinician must be able to create a patient, create a wound under that patient, and add multiple encounters to that same wound.
2. Every encounter must preserve:
   - original image
   - calibrated capture metadata
   - wound mask
   - standardized measurements
   - model outputs
   - clinician overrides
3. Progression must compare the current encounter against prior encounters of the same wound.
4. Progression must use calibrated and comparable metrics, not just raw pixels.
5. The AI stack must use actual Hugging Face models, with wound-specific fine-tuning where needed.
6. Every model-driven field must carry confidence, provenance, and clinician-review status.

## Required architecture changes

### 1. Fix the wound identity workflow first

The current biggest product failure is not AI; it is identity and repeatability.

Required changes:

- add first-class entities in the UI:
  - patient list
  - wound list per patient
  - create new wound
  - add follow-up encounter to existing wound
- stop deriving `patient_id` and `wound_id` from a one-time `caseId`
- separate:
  - `caseId` = workflow/session/encounter draft id
  - `encounter_id` = saved encounter id
  - `wound_id` = stable wound identity across visits
  - `patient_id` = stable patient identity
- add explicit "resume wound follow-up" flow on the landing page
- require the analysis pipeline to load the most recent comparable encounter for the same `wound_id`

Acceptance criteria:

- a nurse can capture 3 encounters against the same wound without hacking IDs
- the wound record shows all 3 encounters
- the latest encounter automatically compares against the prior one

### 2. Replace heuristic ROI with model-backed wound localization

Current state:

- ROI is produced by grayscale thresholding and connected components

Required implementation:

- use a real Hugging Face segmentation stack
- recommended starting stack:
  - box proposal: Grounding DINO from Hugging Face Transformers docs
  - segmentation: SAM2 or SAM3 from Hugging Face Transformers docs
  - medical bootstrap option: `wanglab/medsam-vit-base` from Hugging Face as a medical-segmentation baseline
- preferred implementation path:
  - prompt Grounding DINO with wound-specific phrases such as `wound`, `pressure injury`, `ulcer`, `skin lesion`
  - pass the proposed box into SAM2 or SAM3 for mask extraction
  - store:
    - box
    - mask
    - mask confidence
    - segmentation model name and version
- final production target:
  - fine-tune a wound-specific segmentation model on wound masks
  - keep SAM2 / SAM3 as fallback or bootstrap tooling

Acceptance criteria:

- ROI output is based on a real model and returns a stored binary wound mask
- segmentation confidence is saved with the encounter
- comparison logic uses the wound mask, not a bbox rectangle

### 3. Replace fake classification with real image-based inference

Current state:

- the classifier ignores image content and derives `pressure_injury_probability` from hardcoded heuristics

Required implementation:

- create a proper wound classification service backed by a Hugging Face vision model
- recommended bootstrap approach:
  - use `microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224` for zero-shot or embedding-based initialization
- recommended production approach:
  - fine-tune a wound-specific classification head on top of:
    - BiomedCLIP, or
    - DINOv2 / another HF vision encoder
- expected outputs:
  - wound type probabilities
  - concern probability
  - uncertainty score
  - embedding vector for longitudinal similarity

Minimum labels to support:

- pressure injury
- diabetic ulcer
- venous ulcer
- surgical wound
- traumatic wound
- moisture-associated skin damage
- intact skin / non-wound / unclear

Acceptance criteria:

- inference consumes the wound image or masked crop
- class probabilities change because of image content, not just risk-form toggles
- the model card, checkpoint version, and confidence values are saved in the audit trail

### 4. Build proper wound metrics from the segmentation mask

Current state:

- measurements are partly scaffolded, but the live pipeline only fills a small subset
- `severity_score` is currently a thin heuristic

Required implementation:

- derive all geometry from the wound mask:
  - area
  - major-axis length
  - perpendicular width
  - perimeter
  - shape regularity
- only populate centimeter units when calibration is valid
- if calibration is missing:
  - allow pixel-space storage
  - mark metrics as not longitudinally comparable for healing decisions
- add image-quality checks at inference time:
  - blur
  - darkness
  - glare
  - framing
  - reference-marker presence

Required output flags:

- `comparable_for_progression`
- `calibration_valid`
- `image_quality_score`
- `measurement_confidence`

Acceptance criteria:

- progression logic can reject a pair of encounters when the images are not comparable
- centimeter-based trend calls are only made when calibration and quality pass thresholds

### 5. Implement progression as the primary product feature

This is the central feature. It needs its own model-driven design, not a small helper.

Required progression inputs:

- prior encounter image
- current encounter image
- prior wound mask
- current wound mask
- calibrated area and perimeter
- tissue composition
- concern score
- severity score
- image quality and comparability flags
- elapsed time since previous encounter
- optional clinician-entered measurements

Required progression outputs:

- `improving`
- `stable`
- `worsening`
- `not_comparable`
- explanation object with:
  - area delta percent
  - perimeter delta percent
  - severity delta
  - tissue-change summary
  - image-quality comparability result
  - days since prior encounter

Recommended modeling path:

- phase 1:
  - deterministic progression engine over calibrated metrics plus quality gates
  - use masked-image embeddings from BiomedCLIP or DINOv2 to compute visual similarity
- phase 2:
  - train a pairwise progression model on encounter pairs using Hugging Face tooling
  - input: prior encounter + current encounter + structured deltas
  - output: improving / stable / worsening / not-comparable

Hard rule:

- do not call healing or worsening from `area_px` alone when calibration is absent

Acceptance criteria:

- progression compares encounter N against encounter N-1 for the same wound
- the system can abstain with `not_comparable`
- the UI shows prior photo, current photo, and supporting deltas

### 6. Make concern estimation a real model layer

Current state:

- concern is mainly threshold logic on one probability

Required implementation:

- concern must combine:
  - wound-type classifier outputs
  - segmentation-derived measurements
  - severity model output
  - progression state
  - quality/uncertainty flags
  - risk-form context
- implement this as a small learned model or calibrated meta-model
- recommended simple production path:
  - train a gradient-boosted model or shallow MLP over model outputs and risk features
  - persist it as a versioned artifact alongside the HF models

Acceptance criteria:

- concern is no longer derived from a static threshold ladder
- concern can rise because the wound is worsening over time
- concern can abstain when image quality or segmentation quality is too poor

### 7. Keep note generation safe and structured

Required implementation:

- do not let a language model invent clinical findings
- generate a structured JSON first
- generate the note only from validated structured fields
- recommended path:
  - primary path: deterministic note template from structured outputs
  - optional secondary path: Hugging Face text-generation model for rephrasing only
- if using a text-generation model, constrain it to:
  - rewrite only
  - no new facts
  - preserve measurements and progression labels exactly

Acceptance criteria:

- note text cannot contradict stored measurements or progression output
- every sentence in the note is traceable to structured fields

### 8. Upgrade the checklist from a template into a rules + state engine

Required implementation:

- prevention actions must depend on:
  - body site
  - wound type
  - severity
  - progression
  - device risk
  - moisture risk
  - support-surface usage
- actions must be prioritized by urgency
- worsening progression must change the checklist

Acceptance criteria:

- a worsening heel wound and a stable sacral wound do not return nearly identical checklists

## Recommended Hugging Face model stack

This is the practical stack to implement first.

### Localization / segmentation

- `facebook/sam2` or a SAM2 checkpoint on Hugging Face
- `facebook/sam3` if concept-prompt segmentation is preferred
- `wanglab/medsam-vit-base` as a medical-domain bootstrap baseline
- `IDEA-Research/grounding-dino-*` via Hugging Face Transformers for promptable wound box proposals

### Image representation / classification

- `microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224`
- optionally fine-tune a DINOv2-family encoder from Hugging Face for wound-specific labels

### Optional text generation

- a small instruction model from Hugging Face only for constrained note rewriting
- do not put raw clinical reasoning on an unconstrained text model

## Data requirements

Without proper wound data, the AI will remain shallow.

Required dataset components:

- wound photos across repeated encounters
- wound masks
- wound type labels
- clinician-reviewed severity labels
- calibrated reference objects where available
- pairwise progression labels:
  - improving
  - stable
  - worsening
  - not comparable

Required annotation schema:

- `patient_id`
- `wound_id`
- `encounter_id`
- body site
- wound type
- wound mask
- clinician-measured area / length / width / depth
- tissue labels
- exudate labels
- image-quality flags
- progression label against previous encounter

## Repo changes required

### Data model

- keep `patient -> wound -> encounter`
- add explicit wound creation and encounter-append APIs
- stop overloading `caseId` as wound identity
- persist:
  - inference metadata
  - segmentation confidence
  - image embeddings
  - progression comparability flags

### Service layer

- replace `lib/services/classifier-service.ts`
- replace `lib/services/roi-service.ts`
- redesign `lib/services/full-pipeline-service.ts`
- upgrade `lib/server/progression.ts`
- add separate services for:
  - segmentation inference
  - feature embedding extraction
  - progression comparison
  - image quality analysis

### UI

- landing page:
  - create patient
  - choose wound
  - add follow-up encounter
- results page:
  - show prior encounter photo next to current
  - show deltas clearly
  - show comparability status
- review page:
  - preserve AI values separately from clinician overrides
- export page:
  - include progression explanation and prior-encounter reference

## Phased execution plan

### Phase 0: Stabilize the app

- fix the current build failure
- fix schema mismatches in capture-reference types
- add tests around patient / wound / encounter persistence

### Phase 1: Make repeat encounters real

- add stable patient and wound identities
- add follow-up encounter workflow
- ensure case loading returns prior encounters for the same wound

### Phase 2: Ship real localization

- integrate Grounding DINO + SAM2 or SAM3
- persist masks and confidence
- remove threshold-based ROI as primary path

### Phase 3: Ship real classification

- integrate BiomedCLIP-based inference
- fine-tune a wound classifier checkpoint
- version the checkpoint and save inference metadata

### Phase 4: Ship real measurements

- derive measurements from masks
- add quality gating and comparability logic
- block healing/worsening calls when calibration is not adequate

### Phase 5: Ship real progression

- compare same-wound encounters only
- compute trend over calibrated metrics and embeddings
- add `not_comparable`
- update alerts, checklist, and note generation to use progression

### Phase 6: Clinical hardening

- collect evaluation metrics
- tune thresholds
- run retrospective validation against clinician labels
- publish model cards and internal validation notes

## Definition of done

WoundWatch can be considered aligned with the product idea only when all of the following are true:

- a clinician can add follow-up encounters to the same wound in the normal UI
- wound localization uses a real Hugging Face model
- wound classification uses a real image-based model
- progression is based on repeat encounters of the same wound
- the app can say `not_comparable` instead of guessing
- healing/worsening is supported by stored deltas and visible prior evidence
- note text and prevention actions are driven by structured model outputs and progression state
- every AI field is auditable by model name, version, confidence, and clinician override status

## Suggested first implementation milestone

If only one milestone is funded first, do this:

1. Fix wound identity and follow-up encounter workflow.
2. Replace ROI with Grounding DINO + SAM2 or SAM3.
3. Replace the fake classifier with BiomedCLIP-based image inference.
4. Rebuild progression around calibrated mask-derived area and quality gates.

That is the minimum scope that turns the app from a documentation demo into a real progression-tracking product.

## References used for model selection

- SAM2 docs: https://huggingface.co/docs/transformers/en/model_doc/sam2
- SAM3 docs: https://huggingface.co/docs/transformers/en/model_doc/sam3
- Grounding DINO docs: https://huggingface.co/docs/transformers/main/en/model_doc/grounding-dino
- Hugging Face zero-shot object detection guide: https://huggingface.co/docs/transformers/v4.56.0/en/tasks/zero_shot_object_detection
- BiomedCLIP model card: https://huggingface.co/microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224
- Hugging Face segmentation task docs: https://huggingface.co/docs/transformers/tasks/semantic_segmentation
- Hugging Face pipeline docs: https://huggingface.co/docs/transformers/main_classes/pipelines
