import path from "path";
import { mkdir } from "fs/promises";

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const CASES_DIR = path.join(DATA_DIR, "cases");
export const PATIENTS_DIR = path.join(DATA_DIR, "patients");
export const WOUNDS_DIR = path.join(DATA_DIR, "wounds");
export const ENCOUNTERS_DIR = path.join(DATA_DIR, "encounters");
export const OUTPUTS_DIR = path.join(DATA_DIR, "outputs");
export const UPLOADS_DIR = path.join(ROOT_DIR, "uploads");

export async function ensureAppDirectories() {
  await Promise.all([
    mkdir(CASES_DIR, { recursive: true }),
    mkdir(PATIENTS_DIR, { recursive: true }),
    mkdir(WOUNDS_DIR, { recursive: true }),
    mkdir(ENCOUNTERS_DIR, { recursive: true }),
    mkdir(OUTPUTS_DIR, { recursive: true }),
    mkdir(UPLOADS_DIR, { recursive: true })
  ]);
}
