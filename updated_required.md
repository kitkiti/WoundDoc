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

## Repo-mapped implementation backlog

This section maps the required work to the current repository so implementation can start immediately.

## Priority 0: Fix broken or misleading foundations

### ~~P0.1 Fix the build until `npm run verify` passes~~

Target files:

- [package.json](/home/syed-naveed-mahmood/wounddoc/WoundDoc/package.json)
- [app/cases/[caseId]/results/page.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/cases/[caseId]/results/page.tsx)
- [app/cases/[caseId]/review/page.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/cases/[caseId]/review/page.tsx)
- [app/cases/[caseId]/export/page.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/cases/[caseId]/export/page.tsx)

Work:

- run `next build` until the specific failure is identified
- fix any route, type, or client-render issues
- remove obviously broken text formatting artifacts in the results UI such as stray `?` separators

Definition of done:

- `npm run verify` passes locally

### ~~P0.2 Fix capture reference schema mismatch~~

Current problem:

- UI emits `marker` and `color_card`
- schema allows `ruler`, `calibration_card`, `other`

Target files:

- [lib/types/schema.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/types/schema.ts)
- [app/cases/[caseId]/upload/page.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/cases/[caseId]/upload/page.tsx)
- [lib/services/capture-context-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/capture-context-service.ts)

Work:

- standardize the enum values
- make upload UI and parser use the same values
- add validation tests for reference capture parsing

Definition of done:

- all reference types in the UI round-trip cleanly through upload, parse, save, load, and display

## Priority 1: Make same-wound follow-up encounters possible

### ~~P1.1 Stop using `caseId` as the implicit wound identity~~

Current problem:

- the app creates a new case UUID from the landing page
- non-demo identities are derived from that case
- this prevents natural repeat-encounter tracking

Target files:

- [components/landing-actions.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/components/landing-actions.tsx)
- [lib/server/case-record.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/server/case-record.ts)
- [app/api/full-pipeline/route.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/api/full-pipeline/route.ts)
- [app/api/upload/route.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/api/upload/route.ts)
- [lib/server/storage.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/server/storage.ts)

Work:

- introduce explicit request fields for:
  - `patientId`
  - `woundId`
  - `encounterId`
- reserve `caseId` for transient UI workflow only, or remove it entirely from persistent identity
- make encounter creation require an existing wound for follow-up flows
- keep demo identities stable, but do not special-case demos in the persistence design

Definition of done:

- two separate encounters can be saved under one stable `wound_id`

### ~~P1.2 Add patient and wound selection to the UI~~

Target files:

- [app/page.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/page.tsx)
- [components/landing-actions.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/components/landing-actions.tsx)
- [lib/client/case-draft.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/client/case-draft.ts)

New files likely required:

- `app/patients/page.tsx`
- `app/patients/[patientId]/page.tsx`
- `app/wounds/[woundId]/new-encounter/page.tsx`
- `components/patient-selector.tsx`
- `components/wound-selector.tsx`

Work:

- add:
  - create patient
  - create wound
  - select existing wound
  - start follow-up encounter
- store selected patient and wound in the draft state

Definition of done:

- a user can intentionally create a follow-up encounter on the same wound from the UI

### ~~P1.3 Expose wound history in the API~~

Target files:

- [app/api/cases/[id]/route.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/api/cases/[id]/route.ts)
- [lib/server/storage.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/server/storage.ts)

New files likely required:

- `app/api/patients/route.ts`
- `app/api/patients/[id]/route.ts`
- `app/api/wounds/route.ts`
- `app/api/wounds/[id]/route.ts`
- `app/api/wounds/[id]/encounters/route.ts`

Work:

- add APIs to fetch:
  - patient detail
  - wound detail
  - wound encounter timeline
  - prior encounter list

Definition of done:

- the frontend can load wound history without inferring it from a case screen

## Priority 2: Replace ROI heuristics with Hugging Face localization

### ~~P2.1 Create a dedicated inference adapter layer~~

Target files:

- [lib/services/roi-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/roi-service.ts)
- [lib/services/full-pipeline-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/full-pipeline-service.ts)
- [README.md](/home/syed-naveed-mahmood/wounddoc/WoundDoc/README.md)

New files likely required:

- `lib/services/inference/hf-client.ts`
- `lib/services/inference/segmentation-service.ts`
- `lib/services/inference/model-registry.ts`
- `lib/services/inference/types.ts`

Work:

- create a clean model adapter interface
- move all HF model invocation behind a stable service boundary
- keep a fallback path only for local development, not as the default product behavior

Definition of done:

- pipeline calls a segmentation service interface instead of image heuristics directly

### P2.2 Implement Grounding DINO + SAM2 or SAM3

Target files:

- [lib/services/roi-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/roi-service.ts)
- [app/api/analyze-roi/route.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/api/analyze-roi/route.ts)
- [lib/types/schema.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/types/schema.ts)

Work:

- replace threshold-based `buildSegmentationMask`
- support:
  - prompt-based wound box proposal
  - mask extraction
  - mask confidence
  - model metadata
- persist the mask and confidence with the encounter

Schema additions needed:

- `segmentation_confidence`
- `segmentation_model_name`
- `segmentation_model_version`
- `mask_embedding_path` or equivalent if stored externally

Definition of done:

- ROI is model-backed and returns a true wound mask

### ~~P2.3 Keep the old ROI logic only as explicit fallback~~

Target files:

- [lib/services/roi-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/roi-service.ts)

Work:

- rename the current logic to an explicit fallback implementation
- ensure the UI labels it as fallback, not normal inference

Definition of done:

- no one can mistake the old heuristic path for the real product implementation

## Priority 3: Implement real image-based wound classification

### P3.1 Replace `classifier-service.ts`

Target files:

- [lib/services/classifier-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/classifier-service.ts)
- [app/api/classify/route.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/api/classify/route.ts)
- [lib/types/schema.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/types/schema.ts)

New files likely required:

- `lib/services/inference/classification-service.ts`
- `lib/services/inference/embedding-service.ts`

Work:

- use masked crop or original image plus wound mask as model input
- bootstrap with BiomedCLIP
- support later fine-tuned checkpoint swap without API changes
- save:
  - top class
  - class probabilities
  - uncertainty
  - model name/version
  - embedding reference

Definition of done:

- probabilities are derived from image inference, not static formulas

### P3.2 Add proper uncertainty handling

Target files:

- [lib/types/schema.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/types/schema.ts)
- [lib/services/classifier-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/classifier-service.ts)
- [lib/services/evaluation-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/evaluation-service.ts)

Work:

- replace generic `top_probability` logic with:
  - calibrated confidence
  - abstention threshold
  - uncertainty reasons from inference or comparability checks

Definition of done:

- the model can abstain cleanly instead of forcing a wound label

## Priority 4: Rebuild wound metrics on top of the segmentation output

### P4.1 Move live pipeline to the richer metrics service

Current problem:

- the repo has a richer `wound-metrics-service.ts`, but the live pipeline does not use it

Target files:

- [lib/services/full-pipeline-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/full-pipeline-service.ts)
- [lib/services/wound-metrics-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/wound-metrics-service.ts)
- [lib/services/measurement-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/measurement-service.ts)

Work:

- stop building `provisionalMetrics` inline in `full-pipeline-service.ts`
- call one authoritative wound-metrics service
- ensure all structured fields are populated from the best available source

Definition of done:

- there is one live source of truth for AI wound metrics

### P4.2 Add comparability gating for progression

Target files:

- [lib/services/wound-metrics-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/wound-metrics-service.ts)
- [lib/server/progression.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/server/progression.ts)
- [lib/types/schema.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/types/schema.ts)

Work:

- add fields such as:
  - `comparable_for_progression`
  - `comparability_reasons`
  - `calibration_valid`
- refuse to make healing/worsening calls when:
  - calibration is absent
  - mask quality is poor
  - image quality is poor
  - body site changes

Definition of done:

- progression can return `not_comparable` instead of guessing

## Priority 5: Make progression the true center of the product

### P5.1 Upgrade progression schema and engine

Target files:

- [lib/server/progression.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/server/progression.ts)
- [lib/types/schema.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/types/schema.ts)
- [lib/server/storage.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/server/storage.ts)

Work:

- add `not_comparable` as a first-class progression state
- compare:
  - calibrated area
  - perimeter
  - shape
  - severity
  - tissue composition
  - image similarity embedding
- include explanation fields:
  - why the trend was called
  - why the trend was rejected

Definition of done:

- progression output is clinically interpretable and auditable

### P5.2 Compare against prior encounter in the normal workflow

Target files:

- [app/api/full-pipeline/route.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/api/full-pipeline/route.ts)
- [lib/server/storage.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/server/storage.ts)

Work:

- load the latest valid prior encounter for the same wound
- if multiple prior encounters exist, support:
  - immediate previous comparison
  - optional baseline trend summary

Definition of done:

- the API always knows which wound history it is comparing against

### P5.3 Show side-by-side progression evidence in the UI

Target files:

- [app/cases/[caseId]/results/page.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/cases/[caseId]/results/page.tsx)
- [app/cases/[caseId]/review/page.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/cases/[caseId]/review/page.tsx)
- [app/cases/[caseId]/export/page.tsx](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/cases/[caseId]/export/page.tsx)

Work:

- show:
  - previous photo
  - current photo
  - previous mask
  - current mask
  - metric deltas
  - comparability state
  - explanation text
- ensure worsening trends are visually obvious

Definition of done:

- a clinician can understand why the app thinks a wound is improving or worsening

## Priority 6: Replace shallow heuristics in concern, checklist, and notes

### P6.1 Replace the current concern ladder

Target files:

- [lib/services/concern-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/concern-service.ts)
- [lib/services/full-pipeline-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/full-pipeline-service.ts)

New files likely required:

- `lib/services/concern-model-service.ts`

Work:

- make concern depend on:
  - classifier outputs
  - progression
  - severity
  - risk form
  - quality gates
- if a learned meta-model is not ready yet, use a versioned rule engine with explicit inputs and weights, not ad hoc thresholds

Definition of done:

- concern can rise because of deterioration over time, not just current-encounter heuristics

### P6.2 Upgrade checklist generation

Target files:

- [lib/services/checklist-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/checklist-service.ts)

Work:

- replace the near-static checklist with rules based on:
  - body site
  - wound type
  - progression
  - severity
  - support surface
  - device risk
  - moisture risk

Definition of done:

- checklist output meaningfully differs across wound context and trend state

### P6.3 Keep note generation deterministic first

Target files:

- [lib/services/note-generator-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/note-generator-service.ts)
- [app/api/generate-note/route.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/app/api/generate-note/route.ts)

Work:

- generate notes from structured fields only
- include:
  - current measurements
  - previous measurements
  - progression state
  - comparability status
  - clinician review requirements

Definition of done:

- no note line depends on invented free text from an unconstrained model

## Priority 7: Clean up unused or misleading code paths

### P7.1 Either wire or remove currently unused richer services

Current issue:

- richer files exist but are not on the live path

Target files:

- [lib/services/wound-metrics-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/wound-metrics-service.ts)
- [lib/services/severity-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/severity-service.ts)
- [lib/services/audit-service.ts](/home/syed-naveed-mahmood/wounddoc/WoundDoc/lib/services/audit-service.ts)

Work:

- decide which services are the real implementation
- delete or archive dead scaffolding
- avoid parallel logic paths that drift

Definition of done:

- there is one authoritative implementation path for each output

## Priority 8: Add evaluation and test coverage

### P8.1 Add unit tests for wound identity and progression logic

New files likely required:

- `lib/server/__tests__/progression.test.ts`
- `lib/server/__tests__/storage.test.ts`
- `lib/services/__tests__/capture-context.test.ts`

Work:

- test:
  - same-wound multi-encounter persistence
  - previous-encounter lookup
  - progression abstention on non-comparable captures
  - calibrated vs uncalibrated measurement behavior

Definition of done:

- progression regressions are caught automatically

### P8.2 Add offline evaluation scripts for model outputs

Target files:

- [WoundDoc_Training_Pipeline.ipynb](/home/syed-naveed-mahmood/wounddoc/WoundDoc/WoundDoc_Training_Pipeline.ipynb)
- [scripts/external-classifier-adapter.example.py](/home/syed-naveed-mahmood/wounddoc/WoundDoc/scripts/external-classifier-adapter.example.py)

New files likely required:

- `scripts/eval-segmentation.py`
- `scripts/eval-classification.py`
- `scripts/eval-progression.py`

Work:

- move from notebook-only experimentation to reproducible evaluation scripts
- compute:
  - segmentation IoU / Dice
  - classification AUROC / F1
  - progression agreement with clinician labels
  - abstention rate on low-quality captures

Definition of done:

- model quality can be measured outside the app runtime

## Recommended execution order in this repo

1. Fix build and schema breakage.
2. Refactor identity so wounds can have real follow-up encounters.
3. Add wound history APIs and UI.
4. Integrate Hugging Face segmentation.
5. Integrate Hugging Face image classification.
6. Move live pipeline onto the richer metrics service.
7. Rebuild progression with comparability gates and a real abstention state.
8. Upgrade concern, checklist, and note generation to use the new structured outputs.
9. Add tests and evaluation scripts.

## Strong implementation rules

- Do not ship more heuristics disguised as AI.
- Do not call an image-processing shortcut a model.
- Do not make healing/worsening claims from raw pixel area when calibration is missing.
- Do not let note generation invent clinical facts.
- Do not keep duplicate logic paths alive unless one is explicitly marked as fallback.

## References used for model selection

- SAM2 docs: https://huggingface.co/docs/transformers/en/model_doc/sam2
- SAM3 docs: https://huggingface.co/docs/transformers/en/model_doc/sam3
- Grounding DINO docs: https://huggingface.co/docs/transformers/main/en/model_doc/grounding-dino
- Hugging Face zero-shot object detection guide: https://huggingface.co/docs/transformers/v4.56.0/en/tasks/zero_shot_object_detection
- BiomedCLIP model card: https://huggingface.co/microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224
- Hugging Face segmentation task docs: https://huggingface.co/docs/transformers/tasks/semantic_segmentation
- Hugging Face pipeline docs: https://huggingface.co/docs/transformers/main_classes/pipelines
