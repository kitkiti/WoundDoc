import assert from "node:assert/strict";
import test from "node:test";
import {
    getSegmentationModelDescriptor,
    getSegmentationProviderConfig
} from "../lib/services/inference/model-registry";

function withEnv(variables: Record<string, string | undefined>, callback: () => void) {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(variables)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("segmentation registry defaults to the fallback provider", () => {
  withEnv(
    {
      WOUNDDOC_SEGMENTATION_PROVIDER: undefined,
      WOUNDDOC_SEGMENTATION_MODEL: undefined,
      WOUNDDOC_SEGMENTATION_MODEL_VERSION: undefined,
      WOUNDDOC_SEGMENTATION_ENDPOINT: undefined,
      WOUNDDOC_SEGMENTATION_ALLOW_FALLBACK: undefined
    },
    () => {
      const config = getSegmentationProviderConfig();
      const descriptor = getSegmentationModelDescriptor();

      assert.equal(config.provider, "fallback");
      assert.equal(config.modelName.includes("grounding-dino"), true);
      assert.equal(descriptor.provider, config.provider);
      assert.equal(descriptor.modelName, config.modelName);
      assert.equal(descriptor.modelVersion, config.modelVersion);
    }
  );
});

test("segmentation registry parses hf endpoint aliases", () => {
  withEnv(
    {
      WOUNDDOC_SEGMENTATION_PROVIDER: "hf-endpoint",
      WOUNDDOC_SEGMENTATION_MODEL: "demo-segmentation-model",
      WOUNDDOC_SEGMENTATION_MODEL_VERSION: "2026.04",
      WOUNDDOC_SEGMENTATION_ENDPOINT: "https://example.invalid/segmentation",
      WOUNDDOC_SEGMENTATION_ALLOW_FALLBACK: "false"
    },
    () => {
      const config = getSegmentationProviderConfig();
      const descriptor = getSegmentationModelDescriptor();

      assert.equal(config.provider, "hf_endpoint");
      assert.equal(config.modelName, "demo-segmentation-model");
      assert.equal(config.modelVersion, "2026.04");
      assert.equal(config.endpoint, "https://example.invalid/segmentation");
      assert.equal(config.allowFallback, false);
      assert.deepEqual(descriptor, {
        provider: "hf_endpoint",
        modelName: "demo-segmentation-model",
        modelVersion: "2026.04",
        endpoint: "https://example.invalid/segmentation",
        allowFallback: false
      });
    }
  );
});