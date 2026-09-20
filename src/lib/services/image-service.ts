import sharp from "sharp";

export const ALLOWED_IMAGE_FORMATS = ["jpeg", "png", "webp"] as const;

const MAX_LONG_EDGE_PX = 2000;
const JPEG_QUALITY = 90;

export function getMaxImageSizeBytes(): number {
  const mb = Number(process.env.MAX_IMAGE_SIZE_MB ?? "8");
  return (Number.isFinite(mb) && mb > 0 ? mb : 8) * 1024 * 1024;
}

export function getMaxUploadImages(): number {
  const n = Number(process.env.MAX_UPLOAD_IMAGES ?? "50");
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export interface ImageValidationResult {
  valid: boolean;
  reason?: string;
  format?: string;
  width?: number;
  height?: number;
}

/**
 * Validates image bytes by sniffing them with sharp rather than trusting the
 * client-provided `file.type` / filename extension.
 */
export async function validateImage(
  buffer: Buffer,
): Promise<ImageValidationResult> {
  const maxBytes = getMaxImageSizeBytes();
  if (buffer.byteLength === 0) {
    return { valid: false, reason: "Empty file" };
  }
  if (buffer.byteLength > maxBytes) {
    return {
      valid: false,
      reason: `File exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`,
    };
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return { valid: false, reason: "File is not a readable image" };
  }

  if (
    !metadata.format ||
    !ALLOWED_IMAGE_FORMATS.includes(
      metadata.format as (typeof ALLOWED_IMAGE_FORMATS)[number],
    )
  ) {
    return {
      valid: false,
      reason: `Unsupported image format: ${metadata.format ?? "unknown"}`,
    };
  }

  if (!metadata.width || !metadata.height) {
    return { valid: false, reason: "Could not read image dimensions" };
  }

  return {
    valid: true,
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
  };
}

/**
 * Normalizes an image before it is sent to the VLM: corrects orientation,
 * converts to sRGB, and downsizes only if it's larger than needed — business
 * card text is small, so we don't compress aggressively.
 */
export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // auto-orient using EXIF, then strip it
    .toColourspace("srgb")
    .resize({
      width: MAX_LONG_EDGE_PX,
      height: MAX_LONG_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}
