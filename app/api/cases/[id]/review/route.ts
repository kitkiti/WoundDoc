import { buildEncounterShell } from "@/lib/server/case-record";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { persistExports } from "@/lib/services/export-service";
import {
  getEncounterRecord,
  saveEncounterRecord,
  sanitizeCaseId,
  getCaseRecord
} from "@/lib/server/storage";
import { reviewStateSchema } from "@/lib/types/schema";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = sanitizeCaseId(params.id);
    const payload = reviewStateSchema.parse(await request.json());
    const current = await getEncounterRecord(caseId);

    if (!current?.analysis) {
      return jsonError("Analysis must be completed before review can be saved.", 400);
    }

    const mergedAnalysis = {
      ...current.analysis,
      wound_metrics: {
        ...current.analysis.wound_metrics,
        clinician_entered: payload.clinician_wound_assessment
      }
    };

    const saved = await saveEncounterRecord(caseId, (existing) => ({
      ...buildEncounterShell(caseId, existing ?? current),
      demo_case_id: existing?.demo_case_id ?? current.demo_case_id ?? null,
      upload: existing?.upload ?? current.upload,
      risk_form: existing?.risk_form ?? current.risk_form,
      analysis: mergedAnalysis,
      review: payload
    }));

    const exportPaths = await persistExports(saved);

    await saveEncounterRecord(caseId, (existing) => ({
      ...buildEncounterShell(caseId, existing ?? saved),
      demo_case_id: existing?.demo_case_id ?? saved.demo_case_id ?? null,
      upload: existing?.upload ?? saved.upload,
      risk_form: existing?.risk_form ?? saved.risk_form,
      analysis: existing?.analysis ?? saved.analysis,
      review: existing?.review ?? saved.review,
      export_paths: exportPaths
    }));

    const finalRecord = await getCaseRecord(caseId);

    return jsonOk({
      case_record: finalRecord
    });
  } catch (error) {
    return jsonError("Failed to save review.", 500, getErrorMessage(error));
  }
}
