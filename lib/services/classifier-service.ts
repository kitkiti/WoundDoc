import { runClassificationInference } from "@/lib/services/inference/classification-service";
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
  const override = input.classifierOverride;
  const result = await runClassificationInference({
    imagePath: input.imagePath,
    roi: input.roi,
    riskForm: input.riskForm,
    demoCaseId: input.demoCaseId,
    classifierOverride: override
  });

  return {
    result,
    demoMode: Boolean(input.demoCaseId),
    modelName: result.model_name ?? result.adapter_name ?? "Baseline Vision Classifier",
    warnings: input.roi.quality_flags
  };
}
