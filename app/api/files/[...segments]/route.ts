import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { ROOT_DIR } from "@/lib/server/paths";
import { jsonError } from "@/lib/server/http";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8"
};

export async function GET(
  _request: Request,
  { params }: { params: { segments: string[] } }
) {
  try {
    const relativePath = params.segments.join("/");

    if (!relativePath.startsWith("uploads/")) {
      return jsonError("Only uploaded files can be served from this endpoint.", 403);
    }

    const resolved = path.resolve(ROOT_DIR, relativePath);
    const uploadsRoot = path.resolve(ROOT_DIR, "uploads");

    if (!resolved.startsWith(uploadsRoot)) {
      return jsonError("Invalid file path.", 403);
    }

    const buffer = await readFile(resolved);
    const extension = path.extname(resolved).toLowerCase();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return jsonError("File not found.", 404);
  }
}
