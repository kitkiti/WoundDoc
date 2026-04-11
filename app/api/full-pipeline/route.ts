import { buildEncounterShell, deriveEncounterIdentity } from "@/lib/server/case-record";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { resolveCaseImageInput } from "@/lib/server/image-source";
import { parseCaptureContext } from "@/lib/services/capture-context-service";
import { persistExports } from "@/lib/services/export-service";
import { runFullPipeline } from "@/lib/services/full-pipeline-service";
import {
  getEncounterRecord,
  getWoundRecord,
  linkCaseToEncounter,
  saveEncounterRecord,
  sanitizeCaseId
} from "@/lib/server/storage";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      caseId?: string;
      encounterId?: string;
      patientId?: string;
      woundId?: string;
      imagePath?: string;
      captureContext?: unknown;
      riskForm?: unknown;
      demoCaseId?: string;
    };
    const caseId = sanitizeCaseId(String(payload.caseId ?? ""));
    const requestedEncounterId = sanitizeCaseId(String(payload.encounterId ?? ""));
    const requestedPatientId = sanitizeCaseId(String(payload.patientId ?? ""));
    const requestedWoundId = sanitizeCaseId(String(payload.woundId ?? ""));

    if (!caseId) {
      return jsonError("caseId is required.");
    }

    const existingEncounter = await getEncounterRecord(caseId);
    const encounterId = existingEncounter?.encounter_id ?? requestedEncounterId;
    const { demoCase, imagePath } = resolveCaseImageInput({
      imagePath: payload.imagePath,
      encounterRecord: existingEncounter,
      demoCaseId: payload.demoCaseId
    });
    const captureContext = parseCaptureContext(
      payload.captureContext ??
        existingEncounter?.capture_context ??
        demoCase?.captureContext ??
        {}
    );
    const identity = deriveEncounterIdentity(
      encounterId,
      existingEncounter,
      payload.demoCaseId
        ? {
            patientId: `demo-patient-${payload.demoCaseId}`,
            woundId: `demo-wound-${payload.demoCaseId}`
          }
        : requestedPatientId && requestedWoundId
          ? {
              patientId: requestedPatientId,
              woundId: requestedWoundId
            }
        : undefined
    );
    if (!encounterId || !identity.patientId || !identity.woundId) {
      return jsonError("encounterId, patientId, and woundId are required.");
    }
    const woundRecord = await getWoundRecord(identity.woundId);
    const priorEncounterIds = (woundRecord?.encounter_ids ?? [])
      .filter((id) => id !== encounterId)
      .slice(-8);
    const priorEncounters = await Promise.all(priorEncounterIds.map((id) => getEncounterRecord(id)));
    const previousEncounter = priorEncounters
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;

    if (!imagePath) {
      return jsonError("Image path was not found for this case.");
    }

    const { output, riskForm, imagePath: resolvedImagePath } = await runFullPipeline({
      caseId: encounterId,
      patientId: identity.patientId,
      woundId: identity.woundId,
      imagePath,
      captureContext,
      riskForm: payload.riskForm ?? existingEncounter?.risk_form ?? demoCase?.riskForm,
      previousEncounter,
      demoCaseId: payload.demoCaseId
    });

    await linkCaseToEncounter(caseId, {
      encounterId,
      patientId: identity.patientId,
      woundId: identity.woundId
    });

    const savedRecord = await saveEncounterRecord(encounterId, (current) => ({
      ...buildEncounterShell(encounterId, current ?? existingEncounter, identity),
      demo_case_id: payload.demoCaseId ?? current?.demo_case_id ?? null,
      upload:
        current?.upload ??
        existingEncounter?.upload ??
        (demoCase
          ? {
              stored_name: demoCase.imageFileName,
              original_name: demoCase.imageFileName,
              mime_type: "image/png",
              size: 0,
              image_url: `/demo/${demoCase.imageFileName}`,
              file_path: resolvedImagePath,
              source: "demo" as const
            }
          : undefined),
      capture_context: captureContext,
      risk_form: riskForm,
      analysis: output,
      review: {
        note_text: output.structured_note.full_note,
        checklist: output.prevention_checklist,
        clinician_acknowledged: false,
        clinician_wound_assessment:
          current?.review?.clinician_wound_assessment ?? output.wound_metrics.clinician_entered
      }
    }));

    const exportPaths = await persistExports(savedRecord);

    await saveEncounterRecord(encounterId, (current) => ({
      ...buildEncounterShell(encounterId, current, identity),
      demo_case_id: current?.demo_case_id ?? payload.demoCaseId ?? null,
      upload: current?.upload,
      capture_context: current?.capture_context,
      risk_form: current?.risk_form,
      analysis: current?.analysis,
      review: current?.review,
      export_paths: exportPaths
    }));

    return jsonOk({
      case_id: caseId,
      output
    });
  } catch (error) {
    return jsonError("Full pipeline failed.", 500, getErrorMessage(error));
  }
}
