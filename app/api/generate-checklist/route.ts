import { caseProgressionSchema, concernOutputSchema, roiResultSchema } from "@/lib/types/schema";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { deriveConcernOutput } from "@/lib/services/concern-service";
import { generateChecklist } from "@/lib/services/checklist-service";
import { parseRiskForm } from "@/lib/services/risk-form-service";
import { classificationResultSchema } from "@/lib/types/schema";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      riskForm?: unknown;
      classification?: unknown;
      concernOutput?: unknown;
      roi?: unknown;
    };

    const riskForm = parseRiskForm(payload.riskForm);
    const classification = classificationResultSchema.parse(payload.classification);
    const roi = roiResultSchema.parse(payload.roi);
    const concernOutput = payload.concernOutput
      ? concernOutputSchema.parse(payload.concernOutput)
      : deriveConcernOutput({
          classification,
          roi,
          riskForm,
          progression: caseProgressionSchema.parse({})
        });

    const preventionChecklist = generateChecklist({
      classification,
      concernOutput,
      riskForm,
      roi,
      progression: caseProgressionSchema.parse({})
    });

    return jsonOk({
      prevention_checklist: preventionChecklist
    });
  } catch (error) {
    return jsonError("Checklist generation failed.", 500, getErrorMessage(error));
  }
}
