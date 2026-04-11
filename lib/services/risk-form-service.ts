import { riskFormSchema, type RiskForm } from "@/lib/types/schema";

export function parseRiskForm(input: unknown): RiskForm {
  return riskFormSchema.parse(input ?? {});
}
