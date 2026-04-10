import { getCaseRecord, sanitizeCaseId } from "@/lib/server/storage";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = sanitizeCaseId(params.id);
    const caseRecord = await getCaseRecord(caseId);

    if (!caseRecord) {
      return jsonError("Case not found.", 404);
    }

    return jsonOk({
      case_record: caseRecord
    });
  } catch (error) {
    return jsonError("Failed to load case.", 500, getErrorMessage(error));
  }
}
