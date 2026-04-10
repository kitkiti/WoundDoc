import { getEncounterRecord, sanitizeCaseId } from "@/lib/server/storage";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { resolveCaseImageInput } from "@/lib/server/image-source";
import { analyzeRoi } from "@/lib/services/roi-service";
import { deriveCalibratedMeasurements } from "@/lib/services/measurement-service";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      caseId?: string;
      imagePath?: string;
      demoCaseId?: string;
      captureContext?: {
        pixels_per_cm?: number | null;
      };
    };
    const caseId = sanitizeCaseId(String(payload.caseId ?? ""));

    if (!caseId) {
      return jsonError("caseId is required.");
    }

    const encounterRecord = await getEncounterRecord(caseId);
    const { demoCase, imagePath } = resolveCaseImageInput({
      imagePath: payload.imagePath,
      encounterRecord,
      demoCaseId: payload.demoCaseId
    });

    if (!imagePath) {
      return jsonError("An uploaded image or demo case is required before ROI analysis.");
    }

    const roi = await analyzeRoi({
      caseId,
      imagePath,
      roiHint: demoCase?.roiHint,
      presetQualityFlags: demoCase?.qualityFlags
    });

    const calibratedMeasurements = deriveCalibratedMeasurements(
      roi,
      payload.captureContext?.pixels_per_cm ?? encounterRecord?.capture_context?.pixels_per_cm
    );

    return jsonOk({
      case_id: caseId,
      roi,
      calibrated_measurements: calibratedMeasurements
    });
  } catch (error) {
    return jsonError("ROI analysis failed.", 500, getErrorMessage(error));
  }
}
