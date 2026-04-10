import {
  checklistItemSchema,
  classificationResultSchema,
  concernOutputSchema
} from "@/lib/types/schema";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { generateStructuredNote } from "@/lib/services/note-generator-service";
import { parseRiskForm } from "@/lib/services/risk-form-service";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      riskForm?: unknown;
      classification?: unknown;
      concernOutput?: unknown;
      checklist?: unknown;
    };

    const structuredNote = generateStructuredNote({
      riskForm: parseRiskForm(payload.riskForm),
      classification: classificationResultSchema.parse(payload.classification),
      concernOutput: concernOutputSchema.parse(payload.concernOutput),
      checklist: checklistItemSchema.array().parse(payload.checklist)
    });

    return jsonOk({
      structured_note: structuredNote
    });
  } catch (error) {
    return jsonError("Note generation failed.", 500, getErrorMessage(error));
  }
}
