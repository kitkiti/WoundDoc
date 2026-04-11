import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import {
  getPatientRecord,
  listWoundRecords,
  sanitizeCaseId
} from "@/lib/server/storage";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = sanitizeCaseId(params.id);
    const patient = await getPatientRecord(patientId);

    if (!patient) {
      return jsonError("Patient not found.", 404);
    }

    const wounds = await listWoundRecords(patient.patient_id);

    return jsonOk({
      patient,
      wounds
    });
  } catch (error) {
    return jsonError("Failed to load patient.", 500, getErrorMessage(error));
  }
}
