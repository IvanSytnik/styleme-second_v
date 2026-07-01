/**
 * Client-side image preprocessing.
 *
 * Resizes user-uploaded images to at most MAX_DIMENSION on the longest side
 * before upload — typically cuts payload 3–5× and shortens upload time
 * significantly on mobile networks.
 *
 * Respects EXIF orientation (handled implicitly by createImageBitmap with
 * imageOrientation: 'from-image').
 *
 * Output: JPEG Blob at the configured quality.
 */

import { LIMITS } from '@styleme/shared';

const MAX_DIMENSION = LIMITS.MAX_IMAGE_DIMENSION;
const JPEG_QUALITY = 0.9;

export interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  resizedSize: number;
}

export async function resizeImage(file: File): Promise<ResizeResult> {
  const originalSize = file.size;

  // createImageBitmap auto-applies EXIF orientation. Fallback to <img> if unsupported.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Safari/older browsers: fall back to <img> + drawImage (no EXIF rotate).
    bitmap = await loadViaImageElement(file);
  }

  const { width, height } = computeTargetSize(bitmap.width, bitmap.height, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Clean up the bitmap to free memory.
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('Failed to encode resized image');

  return { blob, width, height, originalSize, resizedSize: blob.size };
}

function computeTargetSize(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  if (w >= h) {
    return { width: max, height: Math.round((h / w) * max) };
  }
  return { width: Math.round((w / h) * max), height: max };
}

async function loadViaImageElement(file: File): Promise<ImageBitmap> {
  // Convert HTMLImageElement → ImageBitmap via createImageBitmap on the element.
  // Doesn't apply EXIF on older Safari — acceptable degradation.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}
