type SegmentationProvider = "fallback" | "hf_endpoint";

export type SegmentationProviderConfig = {
  provider: SegmentationProvider;
  modelName: string;
  modelVersion: string;
  endpoint?: string;
  apiToken?: string;
  allowFallback: boolean;
};

export function getSegmentationProviderConfig(): SegmentationProviderConfig {
  const configuredProvider =
    process.env.WOUNDDOC_SEGMENTATION_PROVIDER?.trim().toLowerCase() ?? "fallback";
  const provider: SegmentationProvider =
    configuredProvider === "hf-endpoint" || configuredProvider === "hf_endpoint"
      ? "hf_endpoint"
      : "fallback";

  return {
    provider,
    modelName:
      process.env.WOUNDDOC_SEGMENTATION_MODEL?.trim() ??
      "IDEA-Research/grounding-dino-base + facebook/sam2-hiera-large",
    modelVersion: process.env.WOUNDDOC_SEGMENTATION_MODEL_VERSION?.trim() ?? "bootstrap",
    endpoint: process.env.WOUNDDOC_SEGMENTATION_ENDPOINT?.trim(),
    apiToken: process.env.HF_TOKEN?.trim(),
    allowFallback: process.env.WOUNDDOC_SEGMENTATION_ALLOW_FALLBACK !== "false"
  };
}
