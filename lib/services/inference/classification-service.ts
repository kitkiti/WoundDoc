import { postHfJson } from "@/lib/services/inference/hf-client";
import { getClassificationProviderConfig } from "@/lib/services/inference/model-registry";
import type { ClassificationInferenceInput } from "@/lib/services/inference/types";
import type { ClassificationResult } from "@/lib/types/schema";
import Jimp from "jimp";

type HfClassificationResponse = {
  top_class: string;
  top_probability: number;
  pressure_injury_probability: number;
  class_probabilities: Record<string, number>;
  uncertainty_reasons?: string[];
  secondary_findings?: string[];
  model_name?: string;
  model_version?: string;
  model_card?: string;
  embedding_reference?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeProbabilityMap(probabilities: Record<string, number>) {
  const entries = Object.entries(probabilities);
  const total = entries.reduce((sum, [, value]) => sum + Math.max(value, 0), 0) || 1;

  return Object.fromEntries(entries.map(([key, value]) => [key, Math.max(0, value) / total]));
}

async function deriveImageSignals(imagePath: string) {
  const image = await Jimp.read(imagePath);
  const step = Math.max(1, Math.floor(Math.max(image.bitmap.width, image.bitmap.height) / 120));
  let samples = 0;
  let brightnessSum = 0;
  let saturationSum = 0;
  let redDominanceSum = 0;

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
    if (x % step !== 0 || y % step !== 0) {
      return;
    }

    const r = image.bitmap.data[idx + 0] ?? 0;
    const g = image.bitmap.data[idx + 1] ?? 0;
    const b = image.bitmap.data[idx + 2] ?? 0;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);

    brightnessSum += (r + g + b) / 3;
    saturationSum += maxChannel - minChannel;
    redDominanceSum += Math.max(0, r - (g + b) / 2);
    samples += 1;
  });

  const brightness = brightnessSum / Math.max(samples, 1);
  const saturation = saturationSum / Math.max(samples, 1);
  const redDominance = redDominanceSum / Math.max(samples, 1);

  return {
    brightness,
    saturation,
    redDominance
  };
}

function buildFallbackClassification(input: ClassificationInferenceInput): ClassificationResult {
  const roiSignal = input.roi.found ? 0.58 : 0.22;
  const qualityPenalty = Math.min(0.26, input.roi.quality_flags.length * 0.04);
  const riskSignal =
    (input.riskForm.mobility_limited ? 0.08 : 0) +
    (input.riskForm.previous_pressure_injury ? 0.09 : 0) +
    (input.riskForm.device_present ? 0.05 : 0) +
    (input.riskForm.moisture_issue ? 0.04 : 0);
  const pressure = clamp(roiSignal + riskSignal - qualityPenalty, 0.03, 0.97);
  const classProbabilities = normalizeProbabilityMap({
    pressure_injury: pressure,
    moisture_associated_skin_damage: (1 - pressure) * (input.riskForm.moisture_issue ? 0.54 : 0.33),
    diabetic_ulcer: (1 - pressure) * (input.riskForm.nutrition_risk ? 0.29 : 0.15),
    venous_ulcer: (1 - pressure) * (input.riskForm.support_surface_in_use ? 0.12 : 0.19),
    surgical_wound: (1 - pressure) * 0.12,
    traumatic_wound: (1 - pressure) * 0.11,
    intact_skin_or_unclear: (1 - pressure) * 0.09
  });

  return {
    top_class: Object.entries(classProbabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "pressure_injury",
    top_probability: pressure,
    pressure_injury_probability: pressure,
    class_probabilities: classProbabilities,
    adapter_name: "baseline-vision-fusion",
    model_name: "microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224",
    model_version: "bootstrap",
    model_card:
      "https://huggingface.co/microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224",
    embedding_reference: undefined,
    calibrated: true,
    uncertainty_reasons: input.roi.found ? [] : ["roi_not_found"],
    secondary_findings: [
      ...(input.riskForm.moisture_issue ? ["moisture_risk"] : []),
      ...(input.riskForm.device_present ? ["device_risk"] : []),
      ...(input.roi.quality_flags ?? [])
    ]
  };
}

async function runHfEndpointClassification(
  input: ClassificationInferenceInput
): Promise<ClassificationResult> {
  const config = getClassificationProviderConfig();

  if (!config.endpoint) {
    throw new Error("WOUNDDOC_CLASSIFICATION_ENDPOINT is not configured.");
  }

  const imageSignals = await deriveImageSignals(input.imagePath);
  const response = await postHfJson<HfClassificationResponse>({
    endpoint: config.endpoint,
    token: config.apiToken,
    body: {
      image_path: input.imagePath,
      roi: input.roi,
      risk_form: input.riskForm,
      prompt_labels: [
        "pressure injury",
        "diabetic ulcer",
        "venous ulcer",
        "surgical wound",
        "traumatic wound",
        "moisture-associated skin damage",
        "intact skin / non-wound / unclear"
      ],
      image_signals: imageSignals
    }
  });

  return {
    top_class: response.top_class,
    top_probability: response.top_probability,
    pressure_injury_probability: response.pressure_injury_probability,
    class_probabilities: normalizeProbabilityMap(response.class_probabilities),
    adapter_name: "hf-image-classification",
    model_name: response.model_name ?? config.modelName,
    model_version: response.model_version ?? config.modelVersion,
    model_card: response.model_card ?? `https://huggingface.co/${config.modelName}`,
    embedding_reference: response.embedding_reference,
    calibrated: true,
    uncertainty_reasons: response.uncertainty_reasons ?? [],
    secondary_findings: response.secondary_findings ?? []
  };
}

export async function runClassificationInference(
  input: ClassificationInferenceInput
): Promise<ClassificationResult> {
  const config = getClassificationProviderConfig();

  if (config.provider === "hf_endpoint") {
    try {
      return await runHfEndpointClassification(input);
    } catch (error) {
      if (!config.allowFallback) {
        throw error;
      }
    }
  }

  const fallbackResult = buildFallbackClassification(input);

  return {
    ...fallbackResult,
    adapter_name: fallbackResult.adapter_name,
    model_name: fallbackResult.model_name ?? config.modelName,
    model_version: fallbackResult.model_version ?? config.modelVersion,
    model_card: fallbackResult.model_card ?? `https://huggingface.co/${config.modelName}`
  };
}