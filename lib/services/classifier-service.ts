import type { RiskForm, RoiResult } from "@/lib/types/schema";

type RunClassifierInput = {
  imagePath: string;
  riskForm: RiskForm;
  roi: RoiResult;
  demoCaseId?: string;
  classifierOverride?: {
    top_class?: string;
    top_probability?: number;
    pressure_injury_probability?: number;
    class_probabilities?: Record<string, number>;
    uncertainty_reasons?: string[];
    secondary_findings?: string[];
  };
};

export async function runClassifier(input: RunClassifierInput) {
  const baseProbability = input.roi.found ? 0.61 : 0.33;
  const riskBoost =
    (input.riskForm.mobility_limited ? 0.08 : 0) +
    (input.riskForm.previous_pressure_injury ? 0.09 : 0) +
    (input.riskForm.device_present ? 0.05 : 0);
  const pressure = Math.max(0.01, Math.min(0.99, baseProbability + riskBoost));

  const classProbabilities = {
    pressure_injury: pressure,
    moisture_associated_skin_damage: Math.max(0.01, (1 - pressure) * 0.45),
    friction_or_shear: Math.max(0.01, (1 - pressure) * 0.35),
    other: Math.max(0.01, (1 - pressure) * 0.2)
  };

  const override = input.classifierOverride;
  const result = {
    top_class: override?.top_class ?? "pressure_injury",
    top_probability: override?.top_probability ?? pressure,
    pressure_injury_probability: override?.pressure_injury_probability ?? pressure,
    class_probabilities: override?.class_probabilities ?? classProbabilities,
    adapter_name: "baseline-risk-fusion",
    model_version: "0.1.0",
    calibrated: true,
    uncertainty_reasons: override?.uncertainty_reasons ?? (input.roi.found ? [] : ["roi_not_found"]),
    secondary_findings: override?.secondary_findings ?? []
  };

  return {
    result,
    demoMode: Boolean(input.demoCaseId),
    modelName: "Baseline Fusion Classifier",
    warnings: input.roi.quality_flags
  };
}
