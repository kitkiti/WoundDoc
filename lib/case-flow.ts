export const caseSteps = [
  { key: "upload", label: "Upload" },
  { key: "risk", label: "Risk" },
  { key: "analysis", label: "Analysis" },
  { key: "results", label: "Results" },
  { key: "review", label: "Review" },
  { key: "export", label: "Export" }
] as const;

export type CaseStep = (typeof caseSteps)[number]["key"];

export function getStepIndex(step: CaseStep) {
  const index = caseSteps.findIndex((item) => item.key === step);
  return index < 0 ? 0 : index;
}
