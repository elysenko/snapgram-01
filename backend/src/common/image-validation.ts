import { BadRequestException } from '@nestjs/common';

/** Hard ceiling for any uploaded image, enforced by multer and re-checked here. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_MESSAGE = 'Image exceeds 5 MB';

export type ImageMime = 'image/jpeg' | 'image/png';

export interface SniffedImage {
  mime: ImageMime;
  ext: 'jpg' | 'png';
}

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Identify an upload from its leading bytes rather than its filename or the
 * client-supplied Content-Type, both of which are trivially spoofed — a PDF
 * renamed "photo.jpg" must be rejected.
 *
 * Returns null when the buffer is not a supported image.
 */
export function sniffImage(buffer: Buffer): SniffedImage | null {
  if (buffer.length >= JPEG_MAGIC.length && buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (buffer.length >= PNG_MAGIC.length && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return { mime: 'image/png', ext: 'png' };
  }
  return null;
}

/** Map a stored object key back to the Content-Type it should be served with. */
export function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

/**
 * Validate an uploaded file and return its true type.
 *
 * Every failure path is a 400: a missing part, an empty file, an oversized file
 * and an unsupported format are all client errors, never 500s or 413s.
 */
export function validateImageUpload(file?: Express.Multer.File): SniffedImage {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('An image file is required (JPEG or PNG, max 5 MB)');
  }
  if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    throw new BadRequestException(MAX_IMAGE_MESSAGE);
  }
  const sniffed = sniffImage(file.buffer);
  if (!sniffed) {
    throw new BadRequestException('Unsupported image format — upload a JPEG or PNG');
  }
  return sniffed;
}
