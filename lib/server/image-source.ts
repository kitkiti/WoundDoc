import path from "path";
import { getDemoCase } from "@/lib/demo/cases";
import type { EncounterRecord } from "@/lib/types/schema";

type ResolveCaseImageInput = {
  imagePath?: string;
  encounterRecord?: EncounterRecord | null;
  demoCaseId?: string;
};

export function resolveCaseImageInput({ imagePath, encounterRecord, demoCaseId }: ResolveCaseImageInput) {
  const demoCase = demoCaseId ? getDemoCase(demoCaseId) : undefined;

  const resolvedImagePath =
    imagePath ??
    encounterRecord?.upload?.file_path ??
    (demoCase ? path.join(process.cwd(), "public", "demo", demoCase.imageFileName) : undefined);

  return {
    demoCase,
    imagePath: resolvedImagePath
  };
}
