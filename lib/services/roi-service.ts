import path from "path";
import Jimp from "jimp";
import { UPLOADS_DIR } from "@/lib/server/paths";
import { writeBuffer } from "@/lib/server/storage";
import type { RoiResult } from "@/lib/types/schema";

type RoiHint = [number, number, number, number] | {
  bbox?: [number, number, number, number] | null;
} | null;

type AnalyzeRoiInput = {
  caseId: string;
  imagePath: string;
  roiHint?: RoiHint;
  presetQualityFlags?: string[];
};

type PixelPoint = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toPublicAsset(caseId: string, fileName: string) {
  return `/api/files/uploads/${caseId}/${fileName}`;
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

    if (minDistance < bestDistance || (minDistance === bestDistance && component.length > best.length)) {
      bestDistance = minDistance;
      best = component;
    }
  }

  return best;
}

function buildSegmentationMask(
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

async function writeDerivedImages(
  source: Jimp,
  caseId: string,
  bbox: [number, number, number, number],
  maskPixels: number[]
) {
  const [x1, y1, x2, y2] = bbox;
  const width = source.bitmap.width;
  const height = source.bitmap.height;
  const caseDir = path.join(UPLOADS_DIR, caseId);

  const maskImage = new Jimp(width, height, 0x000000ff);
  for (const index of maskPixels) {
    const x = index % width;
    const y = Math.floor(index / width);
    maskImage.setPixelColor(0xffffffff, x, y);
  }

  const overlay = source.clone();
  const tint = Jimp.rgbaToInt(24, 184, 166, 120);
  for (const index of maskPixels) {
    const x = index % width;
    const y = Math.floor(index / width);
    const base = Jimp.intToRGBA(overlay.getPixelColor(x, y));
    overlay.setPixelColor(
      Jimp.rgbaToInt(
        Math.round(base.r * 0.55 + 24 * 0.45),
        Math.round(base.g * 0.55 + 184 * 0.45),
        Math.round(base.b * 0.55 + 166 * 0.45),
        255
      ),
      x,
      y
    );
  }

  overlay.scan(x1, y1, x2 - x1 + 1, y2 - y1 + 1, (_x, _y, idx) => {
    overlay.bitmap.data[idx + 0] = 255;
    overlay.bitmap.data[idx + 1] = 255;
    overlay.bitmap.data[idx + 2] = 255;
    overlay.bitmap.data[idx + 3] = 255;
  });

  const crop = source.clone().crop(x1, y1, x2 - x1 + 1, y2 - y1 + 1);

  await Promise.all([
    writeBuffer(path.join(caseDir, "roi-mask.png"), await maskImage.getBufferAsync(Jimp.MIME_PNG)),
    writeBuffer(path.join(caseDir, "roi-overlay.png"), await overlay.getBufferAsync(Jimp.MIME_PNG)),
    writeBuffer(path.join(caseDir, "roi-crop.png"), await crop.getBufferAsync(Jimp.MIME_PNG))
  ]);

  return {
    crop_url: toPublicAsset(caseId, "roi-crop.png"),
    overlay_url: toPublicAsset(caseId, "roi-overlay.png"),
    mask_url: toPublicAsset(caseId, "roi-mask.png"),
    crop_dimensions: {
      width: x2 - x1 + 1,
      height: y2 - y1 + 1
    },
    tint
  };
}

export async function analyzeRoi({
  caseId,
  imagePath,
  roiHint,
  presetQualityFlags = []
}: AnalyzeRoiInput): Promise<RoiResult> {
  const image = await Jimp.read(imagePath);
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

  const maskPixels = buildSegmentationMask(gray, width, height, roiHint);
  const stats = deriveMaskStats(maskPixels, width, height);

  if (!stats) {
    return {
      found: false,
      bbox: null,
      mask_bbox: null,
      contour_points: 0,
      mask_area_px: null,
      mask_coverage_ratio: null,
      quality_flags: ["segmentation_unavailable", ...presetQualityFlags],
      crop_url: toPublicAsset(caseId, "roi-crop.png"),
      overlay_url: toPublicAsset(caseId, "roi-overlay.png"),
      mask_url: toPublicAsset(caseId, "roi-mask.png"),
      segmentation_method: "intensity_component_v1",
      crop_dimensions: null,
      perimeter_px: null
    };
  }

  const files = await writeDerivedImages(image, caseId, stats.bbox, maskPixels);

  const qualityFlags = [...presetQualityFlags];
  if (stats.coverageRatio > 0.45) qualityFlags.push("large_mask_coverage");
  if (stats.coverageRatio < 0.01) qualityFlags.push("small_mask_coverage");

  return {
    found: true,
    bbox: stats.bbox,
    mask_bbox: stats.bbox,
    contour_points: stats.contour.length,
    mask_area_px: stats.areaPx,
    mask_coverage_ratio: stats.coverageRatio,
    quality_flags: qualityFlags,
    crop_url: files.crop_url,
    overlay_url: files.overlay_url,
    mask_url: files.mask_url,
    segmentation_method: "intensity_component_v1",
    crop_dimensions: files.crop_dimensions,
    perimeter_px: stats.perimeterPx
  };
}
