"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSegmentationProviderConfig = getSegmentationProviderConfig;
exports.getSegmentationModelDescriptor = getSegmentationModelDescriptor;
function getSegmentationProviderConfig() {
    const configuredProvider = process.env.WOUNDDOC_SEGMENTATION_PROVIDER?.trim().toLowerCase() ?? "fallback";
    const provider = configuredProvider === "hf-endpoint" || configuredProvider === "hf_endpoint"
        ? "hf_endpoint"
        : "fallback";
    return {
        provider,
        modelName: process.env.WOUNDDOC_SEGMENTATION_MODEL?.trim() ??
            "IDEA-Research/grounding-dino-base + facebook/sam2-hiera-large",
        modelVersion: process.env.WOUNDDOC_SEGMENTATION_MODEL_VERSION?.trim() ?? "bootstrap",
        endpoint: process.env.WOUNDDOC_SEGMENTATION_ENDPOINT?.trim(),
        apiToken: process.env.HF_TOKEN?.trim(),
        allowFallback: process.env.WOUNDDOC_SEGMENTATION_ALLOW_FALLBACK !== "false"
    };
}
function getSegmentationModelDescriptor() {
    const config = getSegmentationProviderConfig();
    return {
        provider: config.provider,
        modelName: config.modelName,
        modelVersion: config.modelVersion,
        endpoint: config.endpoint,
        allowFallback: config.allowFallback
    };
}
