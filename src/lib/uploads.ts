import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { mediaTypeFor } from "./identify";

// Where shoe photos live.
//
// On Vercel there is no disk that survives a deploy, so photos go to Blob
// storage. Locally there's no Blob token, so they're written to
// public/uploads and served as static files — same API either way, and the
// rest of the app never learns which one it got.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 10 * 1024 * 1024;

/** Set automatically by Vercel once a Blob store is connected. */
const hasBlobStore = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface StoredPhoto {
  /** Where the photo can be fetched — a Blob URL, or /uploads/… locally. */
  url: string;
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export class UploadError extends Error {}

/**
 * Saves one uploaded photo and hands back both its URL and its base64, so the
 * caller can store it and send it for identification without reading it back.
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

  if (hasBlobStore) {
    // addRandomSuffix off: the name is already random, and a stable name
    // keeps the URL predictable if we ever need to re-upload.
    const blob = await put(`shoes/${name}`, buffer, {
      access: "public",
      contentType: mediaType,
      addRandomSuffix: false,
    });
    return { url: blob.url, base64: buffer.toString("base64"), mediaType };
  }

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
