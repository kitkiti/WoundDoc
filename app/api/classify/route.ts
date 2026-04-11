import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { resolveCaseImageInput } from "@/lib/server/image-source";
import { getEncounterRecord, sanitizeCaseId } from "@/lib/server/storage";
import { runClassifier } from "@/lib/services/classifier-service";
import { parseRiskForm } from "@/lib/services/risk-form-service";
import { analyzeRoi } from "@/lib/services/roi-service";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      caseId?: string;
      encounterId?: string;
      imagePath?: string;
      riskForm?: unknown;
      demoCaseId?: string;
    };
    const caseId = sanitizeCaseId(String(payload.caseId ?? ""));
    const encounterId = sanitizeCaseId(String(payload.encounterId ?? caseId));

    if (!caseId) {
      return jsonError("caseId is required.");
    }

    const encounterRecord = await getEncounterRecord(encounterId || caseId);
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
      artifactId: encounterId,
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
      encounter_id: encounterId,
      meta: {
        demo_mode: classifierRun.demoMode,
        model_name: classifierRun.modelName,
        model_version: classifierRun.result.model_version,
        model_card: classifierRun.result.model_card,
        warnings: classifierRun.warnings
      },
      classification: classifierRun.result
    });
  } catch (error) {
    return jsonError("Classification failed.", 500, getErrorMessage(error));
  }
}
