import { getEncounterRecord, sanitizeCaseId } from "@/lib/server/storage";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { resolveCaseImageInput } from "@/lib/server/image-source";
import { parseRiskForm } from "@/lib/services/risk-form-service";
import { analyzeRoi } from "@/lib/services/roi-service";
import { runClassifier } from "@/lib/services/classifier-service";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      caseId?: string;
      imagePath?: string;
      riskForm?: unknown;
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
    const riskForm = parseRiskForm(
      payload.riskForm ?? encounterRecord?.risk_form ?? demoCase?.riskForm ?? {}
    );

    if (!imagePath) {
      return jsonError("An uploaded image or demo case is required before classification.");
    }

    const roi = await analyzeRoi({
      caseId,
      imagePath,
      roiHint: demoCase?.roiHint,
      presetQualityFlags: demoCase?.qualityFlags
    });

    const classifierRun = await runClassifier({
      imagePath,
      riskForm,
      roi,
      demoCaseId: payload.demoCaseId,
      classifierOverride: demoCase?.classifierOverride
    });

    return jsonOk({
      case_id: caseId,
      meta: {
        demo_mode: classifierRun.demoMode,
        model_name: classifierRun.modelName,
        warnings: classifierRun.warnings
      },
      classification: classifierRun.result
    });
  } catch (error) {
    return jsonError("Classification failed.", 500, getErrorMessage(error));
  }
}
