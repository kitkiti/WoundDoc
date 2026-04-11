import type { EncounterRecord } from "@/lib/types/schema";

function nowIso() {
  return new Date().toISOString();
}

export function deriveEncounterIdentity(
  caseId: string,
  encounter?: EncounterRecord | null,
  fallback?: { patientId: string; woundId: string }
) {
  return {
    patientId: encounter?.patient_id ?? fallback?.patientId ?? `patient-${caseId}`,
    woundId: encounter?.wound_id ?? fallback?.woundId ?? `wound-${caseId}`
  };
}

export function buildEncounterShell(
  caseId: string,
  current?: EncounterRecord | null,
  identity?: { patientId: string; woundId: string }
): EncounterRecord {
  const now = nowIso();
  const resolvedIdentity = identity ?? deriveEncounterIdentity(caseId, current);

  return {
    encounter_id: caseId,
    patient_id: current?.patient_id ?? resolvedIdentity.patientId,
    wound_id: current?.wound_id ?? resolvedIdentity.woundId,
    demo_case_id: current?.demo_case_id ?? null,
    created_at: current?.created_at ?? now,
    updated_at: now,
    upload: current?.upload,
    capture_context: current?.capture_context,
    risk_form: current?.risk_form,
    analysis: current?.analysis,
    review: current?.review,
    export_paths: current?.export_paths
  };
}
