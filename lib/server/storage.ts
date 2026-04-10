import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { buildEncounterShell } from "@/lib/server/case-record";
import {
  ENCOUNTERS_DIR,
  PATIENTS_DIR,
  WOUNDS_DIR,
  ensureAppDirectories
} from "@/lib/server/paths";
import {
  caseRecordSchema,
  encounterRecordSchema,
  patientRecordSchema,
  woundRecordSchema,
  type CaseRecord,
  type EncounterRecord,
  type PatientRecord,
  type WoundRecord
} from "@/lib/types/schema";

function nowIso() {
  return new Date().toISOString();
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, payload: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function encounterPath(caseId: string) {
  return path.join(ENCOUNTERS_DIR, `${caseId}.json`);
}

function patientPath(patientId: string) {
  return path.join(PATIENTS_DIR, `${patientId}.json`);
}

function woundPath(woundId: string) {
  return path.join(WOUNDS_DIR, `${woundId}.json`);
}

function summarizeEncounter(encounter: EncounterRecord) {
  return {
    encounter_id: encounter.encounter_id,
    created_at: encounter.created_at,
    updated_at: encounter.updated_at,
    has_analysis: Boolean(encounter.analysis),
    has_review: Boolean(encounter.review)
  };
}

function sortTimeline(encounters: EncounterRecord[]) {
  return encounters
    .map(summarizeEncounter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function buildPatientRecord(encounter: EncounterRecord, current?: PatientRecord | null): PatientRecord {
  const now = nowIso();
  const woundIds = new Set(current?.wound_ids ?? []);
  woundIds.add(encounter.wound_id);

  return patientRecordSchema.parse({
    patient_id: encounter.patient_id,
    created_at: current?.created_at ?? encounter.created_at ?? now,
    updated_at: encounter.updated_at ?? now,
    label: current?.label ?? `Patient ${encounter.patient_id.slice(-6).toUpperCase()}`,
    wound_ids: Array.from(woundIds)
  });
}

function buildWoundRecord(encounter: EncounterRecord, current?: WoundRecord | null): WoundRecord {
  const now = nowIso();
  const encounterIds = new Set(current?.encounter_ids ?? []);
  encounterIds.add(encounter.encounter_id);
  const bodySite = encounter.risk_form?.body_site?.trim();
  const generatedLabel = bodySite
    ? `${bodySite} wound`
    : `Wound ${encounter.wound_id.slice(-6).toUpperCase()}`;

  return woundRecordSchema.parse({
    wound_id: encounter.wound_id,
    patient_id: encounter.patient_id,
    created_at: current?.created_at ?? encounter.created_at ?? now,
    updated_at: encounter.updated_at ?? now,
    label: current?.label ?? generatedLabel,
    body_site: bodySite ?? current?.body_site ?? null,
    encounter_ids: Array.from(encounterIds),
    current_encounter_id: encounter.encounter_id
  });
}

export function sanitizeCaseId(rawValue: string) {
  return rawValue.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
}

export async function writeBuffer(filePath: string, buffer: Buffer) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

export async function getEncounterRecord(caseId: string) {
  if (!caseId) return null;
  const raw = await readJsonFile<EncounterRecord>(encounterPath(caseId));
  return raw ? encounterRecordSchema.parse(raw) : null;
}

export async function getPatientRecord(patientId: string) {
  if (!patientId) return null;
  const raw = await readJsonFile<PatientRecord>(patientPath(patientId));
  return raw ? patientRecordSchema.parse(raw) : null;
}

export async function getWoundRecord(woundId: string) {
  if (!woundId) return null;
  const raw = await readJsonFile<WoundRecord>(woundPath(woundId));
  return raw ? woundRecordSchema.parse(raw) : null;
}

export async function saveEncounterRecord(
  caseId: string,
  updater: (current: EncounterRecord | null) => EncounterRecord
) {
  await ensureAppDirectories();
  const current = await getEncounterRecord(caseId);
  const next = encounterRecordSchema.parse(updater(current));

  await writeJsonFile(encounterPath(caseId), next);

  const [existingPatient, existingWound] = await Promise.all([
    getPatientRecord(next.patient_id),
    getWoundRecord(next.wound_id)
  ]);
  const patient = buildPatientRecord(next, existingPatient);
  const wound = buildWoundRecord(next, existingWound);

  await Promise.all([
    writeJsonFile(patientPath(next.patient_id), patient),
    writeJsonFile(woundPath(next.wound_id), wound)
  ]);

  return next;
}

export async function getCaseRecord(caseId: string): Promise<CaseRecord | null> {
  const encounter = await getEncounterRecord(caseId);
  if (!encounter) return null;

  const [patient, wound] = await Promise.all([
    getPatientRecord(encounter.patient_id),
    getWoundRecord(encounter.wound_id)
  ]);

  if (!patient || !wound) return null;

  const encounters = await Promise.all(wound.encounter_ids.map((id) => getEncounterRecord(id)));
  const timeline = sortTimeline(encounters.filter((entry): entry is EncounterRecord => Boolean(entry)));

  return caseRecordSchema.parse({ patient, wound, encounter, timeline });
}

export async function createEncounterRecord(caseId: string) {
  return saveEncounterRecord(caseId, (current) => buildEncounterShell(caseId, current));
}
