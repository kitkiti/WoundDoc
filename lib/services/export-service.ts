import path from "path";
import { mkdir, writeFile } from "fs/promises";
import type { EncounterRecord } from "@/lib/types/schema";
import { OUTPUTS_DIR } from "@/lib/server/paths";

export async function persistExports(encounter: EncounterRecord) {
  const caseDir = path.join(OUTPUTS_DIR, encounter.encounter_id);
  await mkdir(caseDir, { recursive: true });

  const jsonPath = path.join(caseDir, "encounter.json");
  const notePath = path.join(caseDir, "note.txt");

  await writeFile(jsonPath, `${JSON.stringify(encounter, null, 2)}\n`, "utf8");
  await writeFile(notePath, `${encounter.review?.note_text ?? encounter.analysis?.structured_note.full_note ?? ""}\n`, "utf8");

  return {
    json_path: jsonPath,
    note_path: notePath
  };
}
