import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { getWoundEncounterRecords, getWoundRecord, sanitizeCaseId } from "@/lib/server/storage";

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

    const encounters = await getWoundEncounterRecords(woundId);

    return jsonOk({
      wound,
      encounters
    });
  } catch (error) {
    return jsonError("Failed to load wound encounters.", 500, getErrorMessage(error));
  }
}
