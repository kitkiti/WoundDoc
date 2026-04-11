import Jimp from "jimp";
import type { SegmentationInferenceInput, SegmentationMaskResult } from "@/lib/services/inference/types";
import type { RoiHint } from "@/lib/services/inference/types";

type PixelPoint = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function inferThreshold(gray: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < gray.length; i += 1) {
    sum += gray[i];
  }

  const mean = sum / gray.length;
  return clamp(Math.round(mean * 0.82), 24, 220);
}

function neighbors(index: number, width: number, height: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  const result: number[] = [];

  if (x > 0) result.push(index - 1);
  if (x < width - 1) result.push(index + 1);
  if (y > 0) result.push(index - width);
  if (y < height - 1) result.push(index + width);

  return result;
}

function componentClosestToSeed(mask: Uint8Array, width: number, height: number, seedIndex: number) {
  const visited = new Uint8Array(mask.length);
  let best: number[] = [];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) {
      continue;
    }

    const queue: number[] = [index];
    visited[index] = 1;
    const component: number[] = [];

    while (queue.length > 0) {
      const node = queue.pop()!;
      component.push(node);

      for (const neighbor of neighbors(node, width, height)) {
        if (mask[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }

    if (component.length < 24) {
      continue;
    }

    let minDistance = Number.POSITIVE_INFINITY;
    for (const node of component) {
      const dx = (node % width) - (seedIndex % width);
      const dy = Math.floor(node / width) - Math.floor(seedIndex / width);
      const distance = dx * dx + dy * dy;
      minDistance = Math.min(minDistance, distance);
    }

    if (
      minDistance < bestDistance ||
      (minDistance === bestDistance && component.length > best.length)
    ) {
      bestDistance = minDistance;
      best = component;
    }
  }

  return best;
}

function buildFallbackSegmentationMask(
  gray: Uint8Array,
  width: number,
  height: number,
  roiHint?: RoiHint
) {
  const threshold = inferThreshold(gray);
  const candidate = new Uint8Array(gray.length);

  for (let i = 0; i < gray.length; i += 1) {
    candidate[i] = gray[i] < threshold ? 1 : 0;
  }

  const fallbackSeed = Math.floor(height / 2) * width + Math.floor(width / 2);
  const hint = Array.isArray(roiHint) ? roiHint : roiHint?.bbox;
  const seed = hint
    ? clamp(Math.round((hint[1] + hint[3]) / 2), 0, height - 1) * width +
      clamp(Math.round((hint[0] + hint[2]) / 2), 0, width - 1)
    : fallbackSeed;

  return componentClosestToSeed(candidate, width, height, seed);
}

function deriveMaskStats(maskPixels: number[], width: number, height: number) {
  if (maskPixels.length === 0) {
    return null;
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  const maskMap = new Uint8Array(width * height);
  for (const index of maskPixels) {
    maskMap[index] = 1;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  let perimeterPx = 0;
  const contour: PixelPoint[] = [];
  for (const index of maskPixels) {
    const adjacent = neighbors(index, width, height);
    const boundary = adjacent.some((node) => !maskMap[node]) || adjacent.length < 4;

    if (boundary) {
      perimeterPx += 1;
      contour.push({ x: index % width, y: Math.floor(index / width) });
    }
  }

  return {
    bbox: [minX, minY, maxX, maxY] as [number, number, number, number],
    areaPx: maskPixels.length,
    perimeterPx,
    coverageRatio: maskPixels.length / (width * height),
    contour
  };
}

export async function runFallbackSegmentation(
  input: SegmentationInferenceInput
): Promise<SegmentationMaskResult> {
  const image = await Jimp.read(input.imagePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const gray = new Uint8Array(width * height);

  let pointer = 0;
  image.scan(0, 0, width, height, (_x, _y, idx) => {
    const r = image.bitmap.data[idx + 0];
    const g = image.bitmap.data[idx + 1];
    const b = image.bitmap.data[idx + 2];
    gray[pointer] = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    pointer += 1;
  });

  const maskPixels = buildFallbackSegmentationMask(gray, width, height, input.roiHint);
  const stats = deriveMaskStats(maskPixels, width, height);

  if (!stats) {
    return {
      found: false,
      bbox: null,
      maskPixels: [],
      contourPoints: 0,
      areaPx: null,
      perimeterPx: null,
      coverageRatio: null,
      qualityFlags: ["segmentation_unavailable", ...(input.presetQualityFlags ?? [])],
      segmentationMethod: "fallback_intensity_component_v1",
      segmentationConfidence: null,
      segmentationModelName: "fallback_intensity_component_v1",
      segmentationModelVersion: "1.0.0"
    };
  }

  const qualityFlags = [...(input.presetQualityFlags ?? [])];
  if (stats.coverageRatio > 0.45) qualityFlags.push("large_mask_coverage");
  if (stats.coverageRatio < 0.01) qualityFlags.push("small_mask_coverage");

  return {
    found: true,
    bbox: stats.bbox,
    maskPixels,
    contourPoints: stats.contour.length,
    areaPx: stats.areaPx,
    perimeterPx: stats.perimeterPx,
    coverageRatio: stats.coverageRatio,
    qualityFlags,
    segmentationMethod: "fallback_intensity_component_v1",
    segmentationConfidence: 0.42,
    segmentationModelName: "fallback_intensity_component_v1",
    segmentationModelVersion: "1.0.0"
  };
}
