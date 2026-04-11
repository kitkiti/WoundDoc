import { UPLOADS_DIR } from "@/lib/server/paths";
import { writeBuffer } from "@/lib/server/storage";
import { runSegmentationInference } from "@/lib/services/inference/segmentation-service";
import type { RoiHint } from "@/lib/services/inference/types";
import type { RoiResult } from "@/lib/types/schema";
import Jimp from "jimp";
import path from "path";

type AnalyzeRoiInput = {
  caseId: string;
  artifactId?: string;
  imagePath: string;
  roiHint?: RoiHint;
  presetQualityFlags?: string[];
};

function toPublicAsset(artifactId: string, fileName: string) {
  return `/api/files/uploads/${artifactId}/${fileName}`;
}

async function writeDerivedImages(
  source: Jimp,
  artifactId: string,
  bbox: [number, number, number, number],
  maskPixels: number[]
) {
  const [x1, y1, x2, y2] = bbox;
  const width = source.bitmap.width;
  const height = source.bitmap.height;
  const caseDir = path.join(UPLOADS_DIR, artifactId);

  const maskImage = new Jimp(width, height, 0x000000ff);
  for (const index of maskPixels) {
    const x = index % width;
    const y = Math.floor(index / width);
    maskImage.setPixelColor(0xffffffff, x, y);
  }

  const overlay = source.clone();
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
    writeBuffer(
      path.join(caseDir, "roi-overlay.png"),
      await overlay.getBufferAsync(Jimp.MIME_PNG)
    ),
    writeBuffer(path.join(caseDir, "roi-crop.png"), await crop.getBufferAsync(Jimp.MIME_PNG))
  ]);

  return {
    crop_url: toPublicAsset(artifactId, "roi-crop.png"),
    overlay_url: toPublicAsset(artifactId, "roi-overlay.png"),
    mask_url: toPublicAsset(artifactId, "roi-mask.png"),
    crop_dimensions: {
      width: x2 - x1 + 1,
      height: y2 - y1 + 1
    }
  };
}

export async function analyzeRoi({
  caseId,
  artifactId,
  imagePath,
  roiHint,
  presetQualityFlags = []
}: AnalyzeRoiInput): Promise<RoiResult> {
  const resolvedArtifactId = artifactId ?? caseId;
  const segmentation = await runSegmentationInference({
    imagePath,
    roiHint,
    presetQualityFlags,
    promptPhrases: ["wound", "pressure injury", "ulcer", "skin lesion"]
  });

  if (!segmentation.found || !segmentation.bbox) {
    return {
      found: false,
      bbox: null,
      mask_bbox: null,
      contour_points: 0,
      mask_area_px: null,
      mask_coverage_ratio: null,
      quality_flags: segmentation.qualityFlags,
      crop_url: toPublicAsset(resolvedArtifactId, "roi-crop.png"),
      overlay_url: toPublicAsset(resolvedArtifactId, "roi-overlay.png"),
      mask_url: toPublicAsset(resolvedArtifactId, "roi-mask.png"),
      segmentation_method: segmentation.segmentationMethod,
      segmentation_confidence: segmentation.segmentationConfidence,
      segmentation_model_name: segmentation.segmentationModelName,
      segmentation_model_version: segmentation.segmentationModelVersion,
      crop_dimensions: null,
      perimeter_px: null
    };
  }

  const image = await Jimp.read(imagePath);
  const files = await writeDerivedImages(
    image,
    resolvedArtifactId,
    segmentation.bbox,
    segmentation.maskPixels
  );

  return {
    found: true,
    bbox: segmentation.bbox,
    mask_bbox: segmentation.bbox,
    contour_points: segmentation.contourPoints,
    mask_area_px: segmentation.areaPx,
    mask_coverage_ratio: segmentation.coverageRatio,
    quality_flags: segmentation.qualityFlags,
    crop_url: files.crop_url,
    overlay_url: files.overlay_url,
    mask_url: files.mask_url,
    segmentation_method: segmentation.segmentationMethod,
    segmentation_confidence: segmentation.segmentationConfidence,
    segmentation_model_name: segmentation.segmentationModelName,
    segmentation_model_version: segmentation.segmentationModelVersion,
    crop_dimensions: files.crop_dimensions,
    perimeter_px: segmentation.perimeterPx
  };
}
