// Created by Haihs on 15/11/2026
// Browser-side essay photo compression (canvas, long edge ~1600px, JPEG <= ~600KB) to spare the server CPU/RAM/disk. Port of imageCompress.js (without the abort signal).
export const IMAGE_MAX_EDGE = 1600;
export const IMAGE_TARGET_BYTES = 600 * 1024;
export const JPEG_QUALITY_STEPS = [0.7, 0.6, 0.5, 0.4];
export const SCALE_STEPS = [1, 0.85, 0.7];

/** Target size: long edge <= maxEdge, aspect ratio kept, small images are never enlarged. */
export const computeTargetSize = (
  width: number,
  height: number,
  maxEdge = IMAGE_MAX_EDGE,
): { width: number; height: number; scaled: boolean } => {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return { width: w, height: h, scaled: false };
  const ratio = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio)),
    scaled: true,
  };
};

/** Order of the compression attempts: lower the quality first, then shrink further. */
export const planCompressionAttempts = (
  scales: number[] = SCALE_STEPS,
  qualities: number[] = JPEG_QUALITY_STEPS,
): { scale: number; quality: number }[] =>
  scales.flatMap((scale) => qualities.map((quality) => ({ scale, quality })));

/** New .jpg file name keeping the original base name. */
export const toJpegFileName = (name: string): string => {
  const base =
    String(name || 'anh')
      .replace(/\.[^.\\/]+$/, '')
      .slice(0, 80) || 'anh';
  return `${base}.jpg`;
};

/** A JPEG that is already small enough is sent as is (saves the student's CPU). */
export const canSkipCompression = (
  file: { type?: string; size?: number },
  targetBytes = IMAGE_TARGET_BYTES,
): boolean =>
  String(file.type ?? '').toLowerCase() === 'image/jpeg' &&
  Number(file.size) > 0 &&
  Number(file.size) <= targetBytes;

/** Only raster photos are compressed; PDF/Word/txt go up untouched. */
export const isCompressibleImage = (file: { type?: string }): boolean =>
  /^image\/(jpeg|png|webp)$/i.test(String(file.type ?? ''));

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));

type Bitmap = ImageBitmap | HTMLImageElement;

const loadBitmap = async (file: File): Promise<Bitmap> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall back to <img> below */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode_failed'));
    };
    img.src = url;
  });
};

/**
 * Compresses to JPEG: the smallest file that meets the target, otherwise the smallest attempt (the caller
 * enforces the hard size cap). Throws an Error whose message is a Vietnamese text when the image cannot be read.
 */
export const compressImage = async (
  file: File,
  { maxEdge = IMAGE_MAX_EDGE, targetBytes = IMAGE_TARGET_BYTES } = {},
): Promise<File> => {
  if (canSkipCompression(file, targetBytes)) return file;
  let bitmap: Bitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    throw new Error('Không đọc được ảnh này. Hãy chọn ảnh JPG/PNG/WebP khác hoặc chụp lại.');
  }
  const srcW = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width;
  const srcH = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height;
  const base = computeTargetSize(srcW, srcH, maxEdge);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let best: Blob | null = null;
  try {
    if (!ctx) throw new Error('no_canvas');
    for (const { scale, quality } of planCompressionAttempts()) {
      canvas.width = Math.max(1, Math.round(base.width * scale));
      canvas.height = Math.max(1, Math.round(base.height * scale));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= targetBytes) break;
    }
  } catch {
    best = null;
  } finally {
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
  if (!best)
    throw new Error(
      'Trình duyệt không nén được ảnh này. Hãy thử ảnh khác hoặc dùng trình duyệt khác.',
    );
  return new File([best], toJpegFileName(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};
