"use client";

import type { PatientRecord } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

type PatientSelectorProps = {
  patients: PatientRecord[];
  selectedPatientId: string;
  onSelect: (patientId: string) => void;
};

export function PatientSelector({
  patients,
  selectedPatientId,
  onSelect
}: PatientSelectorProps) {
  if (patients.length === 0) {
    return (
      <div className="rounded-[22px] bg-mist px-4 py-3 text-sm text-ink/65">
        No patients yet. Create one below to start a wound record.
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {patients.map((patient) => (
        <button
          key={patient.patient_id}
          type="button"
          onClick={() => onSelect(patient.patient_id)}
          className={cn(
            "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
            selectedPatientId === patient.patient_id
              ? "bg-ink text-white"
              : "border border-ink/10 bg-mist text-ink/65"
          )}
        >
          {patient.label}
        </button>
      ))}
    </div>
  );
}
