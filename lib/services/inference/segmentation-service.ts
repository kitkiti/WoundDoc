import { postHfJson } from "@/lib/services/inference/hf-client";
import { runFallbackSegmentation } from "@/lib/services/inference/fallback-segmentation";
import { getSegmentationProviderConfig } from "@/lib/services/inference/model-registry";
import type {
  SegmentationInferenceInput,
  SegmentationMaskResult
} from "@/lib/services/inference/types";

type HfSegmentationResponse = {
  found: boolean;
  bbox: [number, number, number, number] | null;
  mask_pixels?: number[];
  contour_points?: number;
  mask_area_px?: number | null;
  perimeter_px?: number | null;
  mask_coverage_ratio?: number | null;
  quality_flags?: string[];
  segmentation_confidence?: number | null;
  segmentation_model_name?: string;
  segmentation_model_version?: string;
};

async function runHfEndpointSegmentation(
  input: SegmentationInferenceInput
): Promise<SegmentationMaskResult> {
  const config = getSegmentationProviderConfig();

  if (!config.endpoint) {
    throw new Error("WOUNDDOC_SEGMENTATION_ENDPOINT is not configured.");
  }

  const response = await postHfJson<HfSegmentationResponse>({
    endpoint: config.endpoint,
    token: config.apiToken,
    body: {
      image_path: input.imagePath,
      prompt_phrases: input.promptPhrases,
      roi_hint: input.roiHint ?? null
    }
  });

  return {
    found: response.found,
    bbox: response.bbox,
    maskPixels: response.mask_pixels ?? [],
    contourPoints: response.contour_points ?? 0,
    areaPx: response.mask_area_px ?? null,
    perimeterPx: response.perimeter_px ?? null,
    coverageRatio: response.mask_coverage_ratio ?? null,
    qualityFlags: response.quality_flags ?? input.presetQualityFlags ?? [],
    segmentationMethod: "hf_promptable_segmentation",
    segmentationConfidence: response.segmentation_confidence ?? null,
    segmentationModelName: response.segmentation_model_name ?? config.modelName,
    segmentationModelVersion: response.segmentation_model_version ?? config.modelVersion
  };
}

export async function runSegmentationInference(
  input: SegmentationInferenceInput
): Promise<SegmentationMaskResult> {
  const config = getSegmentationProviderConfig();

  if (config.provider === "hf_endpoint") {
    try {
      return await runHfEndpointSegmentation(input);
    } catch (error) {
      if (!config.allowFallback) {
        throw error;
      }
    }
  }

  return runFallbackSegmentation(input);
}
