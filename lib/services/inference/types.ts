export type RoiHint =
  | [number, number, number, number]
  | {
      bbox?: [number, number, number, number] | null;
    }
  | null;

export type SegmentationInferenceInput = {
  imagePath: string;
  promptPhrases: string[];
  roiHint?: RoiHint;
  presetQualityFlags?: string[];
};

export type SegmentationMaskResult = {
  found: boolean;
  bbox: [number, number, number, number] | null;
  maskPixels: number[];
  contourPoints: number;
  areaPx: number | null;
  perimeterPx: number | null;
  coverageRatio: number | null;
  qualityFlags: string[];
  segmentationMethod: string;
  segmentationConfidence: number | null;
  segmentationModelName?: string;
  segmentationModelVersion?: string;
};
