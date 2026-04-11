declare const process: {
  env: Record<string, string | undefined>;
};

export type SegmentationProviderConfig = {
  provider: "fallback" | "hf_endpoint";
  modelName: string;
  modelVersion: string;
  endpoint?: string;
  apiToken?: string;
  allowFallback: boolean;
};

export type SegmentationModelDescriptor = {
  provider: SegmentationProviderConfig["provider"];
  modelName: string;
  modelVersion: string;
  endpoint?: string;
  allowFallback: boolean;
};

export type ClassificationProviderConfig = {
  provider: "fallback" | "hf_endpoint";
  modelName: string;
  modelVersion: string;
  endpoint?: string;
  apiToken?: string;
  allowFallback: boolean;
};

export type ClassificationModelDescriptor = {
  provider: ClassificationProviderConfig["provider"];
  modelName: string;
  modelVersion: string;
  endpoint?: string;
  allowFallback: boolean;
};

export function getSegmentationProviderConfig(): SegmentationProviderConfig {
  const configuredProvider =
    process.env.WOUNDDOC_SEGMENTATION_PROVIDER?.trim().toLowerCase() ?? "fallback";
  const provider: SegmentationProviderConfig["provider"] =
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

export function getSegmentationModelDescriptor(): SegmentationModelDescriptor {
  const config = getSegmentationProviderConfig();

  return {
    provider: config.provider,
    modelName: config.modelName,
    modelVersion: config.modelVersion,
    endpoint: config.endpoint,
    allowFallback: config.allowFallback
  };
}

export function getClassificationProviderConfig(): ClassificationProviderConfig {
  const configuredProvider =
    process.env.WOUNDDOC_CLASSIFICATION_PROVIDER?.trim().toLowerCase() ?? "fallback";
  const provider: ClassificationProviderConfig["provider"] =
    configuredProvider === "hf-endpoint" || configuredProvider === "hf_endpoint"
      ? "hf_endpoint"
      : "fallback";

  return {
    provider,
    modelName:
      process.env.WOUNDDOC_CLASSIFICATION_MODEL?.trim() ??
      "microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224",
    modelVersion: process.env.WOUNDDOC_CLASSIFICATION_MODEL_VERSION?.trim() ?? "bootstrap",
    endpoint: process.env.WOUNDDOC_CLASSIFICATION_ENDPOINT?.trim(),
    apiToken: process.env.HF_TOKEN?.trim(),
    allowFallback: process.env.WOUNDDOC_CLASSIFICATION_ALLOW_FALLBACK !== "false"
  };
}

export function getClassificationModelDescriptor(): ClassificationModelDescriptor {
  const config = getClassificationProviderConfig();

  return {
    provider: config.provider,
    modelName: config.modelName,
    modelVersion: config.modelVersion,
    endpoint: config.endpoint,
    allowFallback: config.allowFallback
  };
}
