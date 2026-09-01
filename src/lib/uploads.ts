import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mediaTypeFor } from "./identify";

// Photos are written to public/uploads and served as plain static files.
// Swap this module for S3 or R2 when one machine stops being enough; nothing
// else in the app knows where the bytes live.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface StoredPhoto {
  /** Public path, e.g. /uploads/ab12….jpg */
  url: string;
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export class UploadError extends Error {}

/**
 * Saves one uploaded photo and hands back both its public URL and its base64,
 * so the caller can store it and send it for identification without reading
 * the file back off disk.
 */
export async function storePhoto(file: File): Promise<StoredPhoto> {
  if (file.size === 0) throw new UploadError("That file was empty.");
  if (file.size > MAX_BYTES) {
    throw new UploadError(
      `That photo is ${(file.size / 1024 / 1024).toFixed(1)}MB. Keep it under 10MB.`,
    );
  }

  const mediaType = mediaTypeFor(file.type);
  if (!mediaType) {
    throw new UploadError(
      "That file isn't an image the app can read. Use a JPEG, PNG, WebP or GIF.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = `${randomBytes(12).toString("hex")}.${EXTENSIONS[mediaType]}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buffer);

  return {
    url: `/uploads/${name}`,
    base64: buffer.toString("base64"),
    mediaType,
  };
}

/** Pulls the usable files out of a multi-file form field. */
export function filesFrom(formData: FormData, field: string): File[] {
  return formData
    .getAll(field)
    .filter((v): v is File => v instanceof File && v.size > 0);
}
