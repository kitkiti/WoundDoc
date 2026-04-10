# WoundWatch To-Do List

This roadmap is based on the current shipped app state in this repository, excluding the training notebook. Today, the app is a solid single-encounter documentation demo. The next phase is to turn it into a wound progression and prioritization system.

## Current State Summary

- The current pipeline is `ROI -> classifier -> concern heuristic -> checklist -> note`.
- The current schema stores one `analysis` object per case, not a wound history across encounters.
- The current model adapter returns class probabilities only.
- The current results UI shows one encounter's ROI, concern output, and checklist, but no longitudinal change.
- The current ROI output is a bounding box, not a wound segmentation mask.
- The current system does not yet produce structured wound measurements such as area, length, width, depth, tissue mix, or progression deltas.

## Descriptive To-Do List

1. (Done) Rebrand product and copy from `WoundDoc Lite` to `WoundWatch` so the product promise reflects longitudinal wound monitoring rather than one-off documentation support.

2. (Done) Replace the current single-case storage model with a `patient -> wound -> encounter` structure so one wound can hold a dated timeline of assessments, images, metrics, notes, and clinician reviews.

3. (Done) Add a `wound_metrics` block to the analysis schema with fields such as `area_px`, `area_cm2`, `length_cm`, `width_cm`, `perimeter_cm`, `tissue_composition`, `periwound_findings`, `exudate_estimate`, `image_quality_score`, `measurement_confidence`, and `severity_score`.

4. (Done) Separate `AI-estimated` values from `clinician-entered` values so the system is transparent about what came from image analysis versus manual assessment.

5. (Done) Treat wound depth carefully. Do not present depth as a reliable number from a single 2D mobile photo unless the capture workflow is calibrated and validated. In the near term, depth should be clinician-entered or explicitly marked as not inferable.

6. (Done) Upgrade ROI localization from bounding-box detection to wound-mask segmentation so the system can support contour-based measurements, tissue estimation, and more reliable comparison over time.

7. (Done) Add a calibrated image capture workflow using a ruler, marker, or color reference card so measurements can be normalized into centimeters rather than remaining distance-sensitive pixel estimates.

8. (Done) Add measurement outputs that matter clinically: wound area, longest length, widest perpendicular width, perimeter, approximate shape regularity, tissue ratios, and visible surrounding skin findings.

9. Add severity estimation as a structured, reviewable layer rather than relying only on class probabilities. Severity should combine image findings, tissue loss cues, tissue composition, risk context, and image quality.

10. Add structured fields for findings that may need manual confirmation, such as depth, tunneling, undermining, odor, pain, drainage character, and signs of infection.

11. Build a progression engine that compares the current encounter with prior encounters for the same wound and outputs `improving`, `stable`, or `worsening` along with supporting deltas.

12. Add progression metrics such as area change percentage, severity change, days since last review, image quality comparability, and whether the wound is on or off an expected healing path.

13. Add alert rules for deterioration, such as rapid area increase, rising severity, no improvement over a defined interval, or low-confidence comparisons due to inconsistent photo capture.

14. Extend the external model adapter contract so inference can return segmentation outputs and structured measurements, not only class probabilities.

15. Update concern generation so it uses wound metrics, severity signals, and previous-encounter comparison instead of only pressure-injury probability plus heuristic penalties.

16. Update note generation so the draft note includes wound size, tissue findings, severity summary, comparison to the previous visit, and a plain-language statement of whether the wound appears to be healing, stable, or worsening.

17. Update prevention and escalation logic so recommendations change based on severity, progression direction, and uncertainty level, not only the current risk form.

18. Add a wound timeline UI that lets clinicians see prior photos, prior metrics, current-versus-previous comparisons, and a compact progression summary at a glance.

19. Add capture-quality checks at upload time, including blur, darkness, framing, and reference-marker presence, so the app can warn when the image is not suitable for measurement or comparison.

20. Add explicit auditability fields such as `model_version`, `measurement_confidence`, `uncertainty_reason`, `clinician_override`, and whether each metric was AI-generated or manually entered.

21. Add evaluation and safety criteria for the new measurement outputs before they are trusted in workflow. This should include segmentation quality, measurement error versus manual tracing, progression agreement with clinician judgment, and false deterioration alert rates.

22. Create a minimum data and annotation plan for future model improvement, including wound masks, clinician-measured dimensions, tissue labels, severity labels, and progression labels across repeated encounters.

## Recommended Build Order

1. First, update the domain model and persistence layer so the app can represent patients, wounds, encounters, and history instead of a single saved analysis.

2. Second, update the API contract and output schema so structured wound measurements and richer inference outputs have a stable place to live.

3. Third, replace bounding-box ROI with wound segmentation and add calibrated measurement support so the system can produce area and size metrics that are worth tracking.

4. Fourth, add severity scoring and manual-clinician confirmation fields so the app can represent wound seriousness in a safer and more interpretable way.

5. Fifth, build progression comparison logic across encounters so the app can determine whether a wound is improving, stable, or worsening.

6. Sixth, update the UI, note generation, checklist generation, and alerting flows so the longitudinal outputs are visible and useful in busy clinical workflows.

7. Seventh, add evaluation, confidence handling, and auditability so the new model behavior is measurable, reviewable, and safer to deploy.
