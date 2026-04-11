import type { CaptureContext, RiskForm, UploadRecord } from "@/lib/types/schema";

export type CaseDraft = {
  upload?: UploadRecord;
  captureContext?: CaptureContext;
  riskForm?: RiskForm;
  demoCaseId?: string;
};

const DRAFT_PREFIX = "woundwatch:draft:";

function getDraftKey(caseId: string) {
  return `${DRAFT_PREFIX}${caseId}`;
}

export function getCaseDraft(caseId: string): CaseDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getDraftKey(caseId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CaseDraft;
  } catch {
    return null;
  }
}

export function saveCaseDraft(caseId: string, patch: Partial<CaseDraft>) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getCaseDraft(caseId) ?? {};
  const next: CaseDraft = {
    ...current,
    ...patch
  };
  window.localStorage.setItem(getDraftKey(caseId), JSON.stringify(next));
}

export function clearCaseDraft(caseId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getDraftKey(caseId));
}
