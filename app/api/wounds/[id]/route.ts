import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import {
  getPatientRecord,
  getWoundRecord,
  getWoundEncounterRecords,
  sanitizeCaseId
} from "@/lib/server/storage";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const woundId = sanitizeCaseId(params.id);
    const wound = await getWoundRecord(woundId);

    if (!wound) {
      return jsonError("Wound not found.", 404);
    }

    const [patient, encounters] = await Promise.all([
      getPatientRecord(wound.patient_id),
      getWoundEncounterRecords(wound.wound_id)
    ]);

    return jsonOk({
      wound,
      patient,
      encounters
    });
  } catch (error) {
    return jsonError("Failed to load wound.", 500, getErrorMessage(error));
  }
}
