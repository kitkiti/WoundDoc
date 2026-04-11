import { randomUUID } from "crypto";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import {
  createPatientRecord,
  listPatientRecords,
  sanitizeCaseId
} from "@/lib/server/storage";

export async function GET() {
  try {
    const patients = await listPatientRecords();
    return jsonOk({ patients });
  } catch (error) {
    return jsonError("Failed to load patients.", 500, getErrorMessage(error));
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { label?: string; patientId?: string };
    const label = payload.label?.trim() ?? "";

    if (!label) {
      return jsonError("Patient label is required.");
    }

    const patient = await createPatientRecord({
      patientId: sanitizeCaseId(payload.patientId ?? `patient-${randomUUID()}`),
      label
    });

    return jsonOk({ patient });
  } catch (error) {
    return jsonError("Failed to create patient.", 500, getErrorMessage(error));
  }
}
