import path from "path";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { buildEncounterShell } from "@/lib/server/case-record";
import {
  CASES_DIR,
  ENCOUNTERS_DIR,
  PATIENTS_DIR,
  WOUNDS_DIR,
  ensureAppDirectories
} from "@/lib/server/paths";
import { deriveCaseProgression } from "@/lib/server/progression";
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

type CaseLinkRecord = {
  case_id: string;
  encounter_id: string;
  patient_id: string;
  wound_id: string;
  created_at: string;
  updated_at: string;
};

type CreatePatientInput = {
  patientId: string;
  label: string;
};

type CreateWoundInput = {
  woundId: string;
  patientId: string;
  label: string;
  bodySite?: string | null;
};

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

async function listJsonRecords<T>(
  directory: string,
  parser: { parse(value: unknown): T }
): Promise<T[]> {
  try {
    const entries = await readdir(directory);
    const records: Array<T | null> = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          const raw = await readJsonFile<unknown>(path.join(directory, entry));
          return raw ? parser.parse(raw) : null;
        })
    );

    return records.filter((record): record is T => record !== null);
  } catch {
    return [];
  }
}

function encounterPath(encounterId: string) {
  return path.join(ENCOUNTERS_DIR, `${encounterId}.json`);
}

function caseLinkPath(caseId: string) {
  return path.join(CASES_DIR, `${caseId}.json`);
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

function sortByUpdatedDesc<T extends { updated_at: string }>(records: T[]) {
  return [...records].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function sanitizeCaseId(rawValue: string) {
  return rawValue.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
}

export async function writeBuffer(filePath: string, buffer: Buffer) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
}

export async function getCaseLinkRecord(caseId: string) {
  if (!caseId) return null;
  return readJsonFile<CaseLinkRecord>(caseLinkPath(caseId));
}

export async function linkCaseToEncounter(
  caseId: string,
  identity: { encounterId: string; patientId: string; woundId: string }
) {
  await ensureAppDirectories();
  const current = await getCaseLinkRecord(caseId);
  const now = nowIso();
  const next: CaseLinkRecord = {
    case_id: caseId,
    encounter_id: identity.encounterId,
    patient_id: identity.patientId,
    wound_id: identity.woundId,
    created_at: current?.created_at ?? now,
    updated_at: now
  };

  await writeJsonFile(caseLinkPath(caseId), next);
  return next;
}

export async function getEncounterRecord(identifier: string) {
  if (!identifier) return null;

  const direct = await readJsonFile<EncounterRecord>(encounterPath(identifier));
  if (direct) {
    return encounterRecordSchema.parse(direct);
  }

  const caseLink = await getCaseLinkRecord(identifier);
  if (!caseLink) {
    return null;
  }

  const linked = await readJsonFile<EncounterRecord>(encounterPath(caseLink.encounter_id));
  return linked ? encounterRecordSchema.parse(linked) : null;
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

export async function listPatientRecords() {
  const patients = await listJsonRecords(PATIENTS_DIR, patientRecordSchema);
  return sortByUpdatedDesc(patients);
}

export async function listWoundRecords(patientId?: string) {
  const wounds = await listJsonRecords(WOUNDS_DIR, woundRecordSchema);
  const filtered = patientId ? wounds.filter((wound) => wound.patient_id === patientId) : wounds;
  return sortByUpdatedDesc(filtered);
}

export async function getWoundEncounterRecords(woundId: string) {
  const wound = await getWoundRecord(woundId);
  if (!wound) {
    return [];
  }

  const encounters = await Promise.all(wound.encounter_ids.map((encounterId) => getEncounterRecord(encounterId)));
  return encounters
    .filter((entry): entry is EncounterRecord => Boolean(entry))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createPatientRecord({ patientId, label }: CreatePatientInput) {
  await ensureAppDirectories();
  const now = nowIso();
  const patient = patientRecordSchema.parse({
    patient_id: patientId,
    created_at: now,
    updated_at: now,
    label: label.trim(),
    wound_ids: []
  });

  await writeJsonFile(patientPath(patientId), patient);
  return patient;
}

export async function createWoundRecord({
  woundId,
  patientId,
  label,
  bodySite
}: CreateWoundInput) {
  await ensureAppDirectories();
  const patient = await getPatientRecord(patientId);

  if (!patient) {
    throw new Error("Patient not found.");
  }

  const now = nowIso();
  const wound = woundRecordSchema.parse({
    wound_id: woundId,
    patient_id: patientId,
    created_at: now,
    updated_at: now,
    label: label.trim(),
    body_site: bodySite?.trim() || null,
    encounter_ids: [],
    current_encounter_id: null
  });
  const updatedPatient = patientRecordSchema.parse({
    ...patient,
    updated_at: now,
    wound_ids: Array.from(new Set([...patient.wound_ids, woundId]))
  });

  await Promise.all([
    writeJsonFile(woundPath(woundId), wound),
    writeJsonFile(patientPath(patientId), updatedPatient)
  ]);

  return wound;
}

export async function saveEncounterRecord(
  encounterId: string,
  updater: (current: EncounterRecord | null) => EncounterRecord
) {
  await ensureAppDirectories();
  const current = await getEncounterRecord(encounterId);
  const next = encounterRecordSchema.parse(updater(current));

  await writeJsonFile(encounterPath(encounterId), next);

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

  const encounterTimeline = await getWoundEncounterRecords(wound.wound_id);
  const timeline = sortTimeline(encounterTimeline);
  const progression = deriveCaseProgression(encounterTimeline, encounter.encounter_id);

  return caseRecordSchema.parse({ patient, wound, encounter, timeline, progression });
}

export async function createEncounterRecord(identity: {
  caseId: string;
  encounterId: string;
  patientId: string;
  woundId: string;
}) {
  await linkCaseToEncounter(identity.caseId, identity);
  return saveEncounterRecord(identity.encounterId, (current) =>
    buildEncounterShell(identity.encounterId, current, {
      patientId: identity.patientId,
      woundId: identity.woundId
    })
  );
}
