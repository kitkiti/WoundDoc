import { getEncounterRecord, sanitizeCaseId } from "@/lib/server/storage";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { resolveCaseImageInput } from "@/lib/server/image-source";
import { analyzeRoi } from "@/lib/services/roi-service";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      caseId?: string;
      imagePath?: string;
      demoCaseId?: string;
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

    return jsonOk({
      case_id: caseId,
      roi
    });
  } catch (error) {
    return jsonError("ROI analysis failed.", 500, getErrorMessage(error));
  }
}
