"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const model_registry_1 = require("../lib/services/inference/model-registry");
function withEnv(variables, callback) {
    const previous = new Map();
    for (const [key, value] of Object.entries(variables)) {
        previous.set(key, process.env[key]);
        if (value === undefined) {
            delete process.env[key];
        }
        else {
            process.env[key] = value;
        }
    }
    try {
        callback();
    }
    finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = value;
            }
        }
    }
}
(0, node_test_1.default)("segmentation registry defaults to the fallback provider", () => {
    withEnv({
        WOUNDDOC_SEGMENTATION_PROVIDER: undefined,
        WOUNDDOC_SEGMENTATION_MODEL: undefined,
        WOUNDDOC_SEGMENTATION_MODEL_VERSION: undefined,
        WOUNDDOC_SEGMENTATION_ENDPOINT: undefined,
        WOUNDDOC_SEGMENTATION_ALLOW_FALLBACK: undefined
    }, () => {
        const config = (0, model_registry_1.getSegmentationProviderConfig)();
        const descriptor = (0, model_registry_1.getSegmentationModelDescriptor)();
        strict_1.default.equal(config.provider, "fallback");
        strict_1.default.equal(config.modelName.includes("grounding-dino"), true);
        strict_1.default.equal(descriptor.provider, config.provider);
        strict_1.default.equal(descriptor.modelName, config.modelName);
        strict_1.default.equal(descriptor.modelVersion, config.modelVersion);
    });
});
(0, node_test_1.default)("segmentation registry parses hf endpoint aliases", () => {
    withEnv({
        WOUNDDOC_SEGMENTATION_PROVIDER: "hf-endpoint",
        WOUNDDOC_SEGMENTATION_MODEL: "demo-segmentation-model",
        WOUNDDOC_SEGMENTATION_MODEL_VERSION: "2026.04",
        WOUNDDOC_SEGMENTATION_ENDPOINT: "https://example.invalid/segmentation",
        WOUNDDOC_SEGMENTATION_ALLOW_FALLBACK: "false"
    }, () => {
        const config = (0, model_registry_1.getSegmentationProviderConfig)();
        const descriptor = (0, model_registry_1.getSegmentationModelDescriptor)();
        strict_1.default.equal(config.provider, "hf_endpoint");
        strict_1.default.equal(config.modelName, "demo-segmentation-model");
        strict_1.default.equal(config.modelVersion, "2026.04");
        strict_1.default.equal(config.endpoint, "https://example.invalid/segmentation");
        strict_1.default.equal(config.allowFallback, false);
        strict_1.default.deepEqual(descriptor, {
            provider: "hf_endpoint",
            modelName: "demo-segmentation-model",
            modelVersion: "2026.04",
            endpoint: "https://example.invalid/segmentation",
            allowFallback: false
        });
    });
});
