import { randomUUID } from "crypto";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import {
  createWoundRecord,
  listWoundRecords,
  sanitizeCaseId
} from "@/lib/server/storage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = sanitizeCaseId(searchParams.get("patientId") ?? "");
    const wounds = await listWoundRecords(patientId || undefined);

    return jsonOk({ wounds });
  } catch (error) {
    return jsonError("Failed to load wounds.", 500, getErrorMessage(error));
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      patientId?: string;
      woundId?: string;
      label?: string;
      bodySite?: string;
    };
    const patientId = sanitizeCaseId(payload.patientId ?? "");
    const woundId = sanitizeCaseId(payload.woundId ?? `wound-${randomUUID()}`);
    const label = payload.label?.trim() ?? "";

    if (!patientId || !label) {
      return jsonError("patientId and wound label are required.");
    }

    const wound = await createWoundRecord({
      woundId,
      patientId,
      label,
      bodySite: payload.bodySite
    });

    return jsonOk({ wound });
  } catch (error) {
    return jsonError("Failed to create wound.", 500, getErrorMessage(error));
  }
}
