"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Plus } from "lucide-react";
import { demoCases } from "@/lib/demo/cases";
import { saveCaseDraft } from "@/lib/client/case-draft";
import { PatientSelector } from "@/components/patient-selector";
import { WoundSelector } from "@/components/wound-selector";
import type { PatientRecord, WoundRecord } from "@/lib/types/schema";

function createId(prefix?: string) {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;

  return prefix ? `${prefix}-${value}` : value;
}

export function LandingActions() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [wounds, setWounds] = useState<WoundRecord[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedWoundId, setSelectedWoundId] = useState("");
  const [newPatientLabel, setNewPatientLabel] = useState("");
  const [newWoundLabel, setNewWoundLabel] = useState("");
  const [newWoundBodySite, setNewWoundBodySite] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.patient_id === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  );
  const selectedWound = useMemo(
    () => wounds.find((wound) => wound.wound_id === selectedWoundId) ?? null,
    [wounds, selectedWoundId]
  );

  const loadPatients = async (preferredPatientId?: string, preferredWoundId?: string) => {
    const response = await fetch("/api/patients");
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to load patients.");
    }

    const loadedPatients = payload.patients as PatientRecord[];
    setPatients(loadedPatients);
    const nextPatientId =
      preferredPatientId && loadedPatients.some((patient) => patient.patient_id === preferredPatientId)
        ? preferredPatientId
        : loadedPatients[0]?.patient_id ?? "";
    setSelectedPatientId(nextPatientId);

    if (nextPatientId) {
      await loadWounds(nextPatientId, preferredWoundId);
    } else {
      setWounds([]);
      setSelectedWoundId("");
    }
  };

  const loadWounds = async (patientId: string, preferredWoundId?: string) => {
    const response = await fetch(`/api/wounds?patientId=${encodeURIComponent(patientId)}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to load wounds.");
    }

    const loadedWounds = payload.wounds as WoundRecord[];
    setWounds(loadedWounds);
    const nextWoundId =
      preferredWoundId && loadedWounds.some((wound) => wound.wound_id === preferredWoundId)
        ? preferredWoundId
        : loadedWounds[0]?.wound_id ?? "";
    setSelectedWoundId(nextWoundId);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await loadPatients();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load patient records.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const handlePatientSelect = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setSelectedWoundId("");
    setError("");

    try {
      await loadWounds(patientId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load wounds.");
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatientLabel.trim()) {
      setError("Enter a patient label before creating the patient.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          label: newPatientLabel.trim()
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to create patient.");
      }

      setNewPatientLabel("");
      await loadPatients(payload.patient.patient_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create patient.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateWound = async () => {
    if (!selectedPatientId) {
      setError("Select a patient before creating a wound.");
      return;
    }

    if (!newWoundLabel.trim()) {
      setError("Enter a wound label before creating the wound.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const response = await fetch("/api/wounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          patientId: selectedPatientId,
          label: newWoundLabel.trim(),
          bodySite: newWoundBodySite.trim()
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to create wound.");
      }

      setNewWoundLabel("");
      setNewWoundBodySite("");
      await loadWounds(selectedPatientId, payload.wound.wound_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create wound.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEncounter = () => {
    if (!selectedPatient || !selectedWound) {
      setError("Select a patient and wound before starting the encounter.");
      return;
    }

    const caseId = createId();
    const encounterId = createId("encounter");

    saveCaseDraft(caseId, {
      patientId: selectedPatient.patient_id,
      patientLabel: selectedPatient.label,
      woundId: selectedWound.wound_id,
      woundLabel: selectedWound.label,
      encounterId
    });
    router.push(`/cases/${caseId}/upload`);
  };

  const handleStartDemo = (demoCaseId: string, title: string) => {
    const caseId = createId();
    saveCaseDraft(caseId, {
      demoCaseId,
      patientId: `demo-patient-${demoCaseId}`,
      patientLabel: `Demo patient ${demoCaseId}`,
      woundId: `demo-wound-${demoCaseId}`,
      woundLabel: title,
      encounterId: createId("encounter")
    });
    router.push(`/cases/${caseId}/analysis?demo=${demoCaseId}`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Patient selection
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Choose an existing patient to continue wound follow-up, or create a new patient before the
          first wound encounter.
        </p>
        <div className="mt-4">
          <PatientSelector
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelect={(patientId) => void handlePatientSelect(patientId)}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={newPatientLabel}
            onChange={(event) => setNewPatientLabel(event.target.value)}
            placeholder="Create patient label"
            className="w-full rounded-[22px] border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-teal"
          />
          <button
            type="button"
            onClick={handleCreatePatient}
            disabled={submitting}
            className="rounded-[22px] bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink/45"
          >
            Create patient
          </button>
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/85 p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
          Wound selection
        </p>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Select an existing wound to add a follow-up encounter, or create a new wound under the
          selected patient.
        </p>
        <div className="mt-4">
          <WoundSelector
            wounds={wounds}
            selectedWoundId={selectedWoundId}
            onSelect={setSelectedWoundId}
          />
        </div>
        <div className="mt-4 grid gap-3">
          <input
            value={newWoundLabel}
            onChange={(event) => setNewWoundLabel(event.target.value)}
            placeholder="Create wound label"
            className="w-full rounded-[22px] border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-teal"
          />
          <input
            value={newWoundBodySite}
            onChange={(event) => setNewWoundBodySite(event.target.value)}
            placeholder="Optional body site"
            className="w-full rounded-[22px] border border-ink/10 bg-mist px-4 py-3 text-sm text-ink outline-none transition focus:border-teal"
          />
          <button
            type="button"
            onClick={handleCreateWound}
            disabled={submitting || !selectedPatientId}
            className="rounded-[22px] border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card transition hover:border-teal disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create wound under selected patient
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleStartEncounter}
        disabled={loading || submitting || !selectedPatient || !selectedWound}
        className="flex w-full items-center justify-center gap-3 rounded-[28px] bg-ink px-5 py-4 text-base font-semibold text-white shadow-float transition hover:bg-teal disabled:cursor-not-allowed disabled:bg-ink/45"
      >
        <Plus className="h-5 w-5" />
        {selectedWound?.encounter_ids.length
          ? "Add follow-up encounter to selected wound"
          : "Start baseline encounter for selected wound"}
      </button>

      {error ? (
        <div className="rounded-[22px] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {demoCases.map((demoCase) => (
          <button
            key={demoCase.id}
            type="button"
            onClick={() => handleStartDemo(demoCase.id, demoCase.title)}
            className="flex w-full items-center gap-4 rounded-[28px] border border-white/70 bg-white/85 p-3 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-float"
          >
            <Image
              src={`/demo/${demoCase.imageFileName}`}
              alt={demoCase.title}
              width={80}
              height={80}
              className="h-20 w-20 rounded-[22px] object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
                {demoCase.badge}
              </p>
              <p className="mt-1 text-base font-semibold text-ink">{demoCase.title}</p>
              <p className="mt-1 text-sm text-ink/65">{demoCase.subtitle}</p>
            </div>
            <Play className="h-5 w-5 text-coral" />
          </button>
        ))}
      </div>
    </div>
  );
}
