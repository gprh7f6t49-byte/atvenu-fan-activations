import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DB_PATH } from "./db";

// Uploaded artwork lives next to the database, so it sits on the persistent volume in production.
export const UPLOAD_DIR = path.join(path.dirname(DB_PATH), "uploads");
export const UPLOAD_PREFIX = "/api/uploads/";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FILE_PATTERN = /^[a-f0-9]{32}\.(jpg|png)$/;

/**
 * Validates an uploaded image and re-encodes it (max 2400px, metadata stripped), so whatever
 * was uploaded, only a clean JPEG/PNG is ever served. Returns its public path.
 */
export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 10 MB or smaller");
  const input = Buffer.from(await file.arrayBuffer());
  let img;
  let meta;
  try {
    img = sharp(input, { limitInputPixels: 60_000_000 }).rotate();
    meta = await img.metadata();
  } catch {
    throw new Error("That file isn't an image we can read. Use a JPG, PNG or WebP.");
  }
  if (!meta.width || !meta.height || !["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"].includes(meta.format ?? "")) {
    throw new Error("That file isn't an image we can read. Use a JPG, PNG or WebP.");
  }
  if (meta.width < 300 || meta.height < 100) throw new Error("That image is too small. Use one at least 1000px wide.");
  const resized = img.resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  const ext = meta.hasAlpha ? "png" : "jpg";
  const out = meta.hasAlpha ? await resized.png().toBuffer() : await resized.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  writeFileSync(path.join(UPLOAD_DIR, name), out);
  return `${UPLOAD_PREFIX}${name}`;
}

/** Reads a stored upload by file name; null for anything that isn't one of ours. */
export function readUploadFile(name: string): { data: Buffer; type: string } | null {
  if (!FILE_PATTERN.test(name)) return null;
  const p = path.join(UPLOAD_DIR, name);
  if (!existsSync(p)) return null;
  return { data: readFileSync(p), type: name.endsWith(".png") ? "image/png" : "image/jpeg" };
}

/** The bytes behind an image URL stored on an activation, when it is an upload (not an external link). */
export function uploadedImage(url: string | null | undefined): Buffer | null {
  if (!url?.startsWith(UPLOAD_PREFIX)) return null;
  return readUploadFile(url.slice(UPLOAD_PREFIX.length))?.data ?? null;
}

/**
 * Applies a form's image field: a new file replaces the image, ticking "remove" clears it,
 * otherwise the current image is kept.
 */
export async function imageFromForm(form: FormData, field: string, current: string | null): Promise<string | null> {
  const file = form.get(field);
  if (file instanceof File && file.size > 0) return saveImage(file);
  if (form.get(`${field}_remove`) === "1") return null;
  return current;
}
