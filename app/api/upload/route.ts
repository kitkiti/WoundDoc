import path from "path";
import { randomUUID } from "crypto";
import Jimp from "jimp";
import { saveEncounterRecord, sanitizeCaseId, writeBuffer } from "@/lib/server/storage";
import { buildEncounterShell } from "@/lib/server/case-record";
import { ensureAppDirectories, UPLOADS_DIR } from "@/lib/server/paths";
import { getErrorMessage, jsonError, jsonOk } from "@/lib/server/http";
import { parseCaptureContext } from "@/lib/services/capture-context-service";

function getFileExtension(file: File) {
  const extensionFromName = path.extname(file.name).toLowerCase();

  if (extensionFromName) {
    return extensionFromName;
  }

  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return ".jpg";
}

export async function POST(request: Request) {
  try {
    await ensureAppDirectories();

    const formData = await request.formData();
    const incomingCaseId = String(formData.get("caseId") ?? randomUUID());
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Image file is required.");
    }

    const caseId = sanitizeCaseId(incomingCaseId || randomUUID());
    const captureContext = parseCaptureContext({
      reference_visible: formData.get("referenceVisible"),
      reference_type: formData.get("referenceType"),
      reference_length_cm: formData.get("referenceLengthCm"),
      reference_length_px: formData.get("referenceLengthPx"),
      notes: formData.get("referenceNotes")
    });
    const extension = getFileExtension(file);
    const storedName = `upload-${Date.now()}${extension}`;
    const filePath = path.join(UPLOADS_DIR, caseId, storedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = await Jimp.read(buffer);

    await writeBuffer(filePath, buffer);

    const upload = {
      stored_name: storedName,
      original_name: file.name || storedName,
      mime_type: file.type || "application/octet-stream",
      size: file.size,
      image_url: `/api/files/uploads/${caseId}/${storedName}`,
      file_path: filePath,
      source: "upload" as const,
      width: image.bitmap.width,
      height: image.bitmap.height
    };

    await saveEncounterRecord(caseId, (current) => ({
      ...buildEncounterShell(caseId, current),
      upload,
      capture_context: captureContext
    }));

    return jsonOk({
      case_id: caseId,
      upload,
      capture_context: captureContext
    });
  } catch (error) {
    return jsonError("Upload failed.", 500, getErrorMessage(error));
  }
}
