// Created by Haihs on 15/11/2026
// Specs for the pure parts of the image compression.
import {
  canSkipCompression,
  computeTargetSize,
  isCompressibleImage,
  planCompressionAttempts,
  toJpegFileName,
} from './image-compress';

describe('image-compress', () => {
  it('keeps the aspect ratio and never enlarges', () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200, scaled: true });
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600, scaled: false });
    expect(computeTargetSize(0, 0)).toEqual({ width: 1, height: 1, scaled: false });
  });
  it('tries quality first, then a smaller scale', () => {
    const plan = planCompressionAttempts();
    expect(plan).toHaveLength(12);
    expect(plan[0]).toEqual({ scale: 1, quality: 0.7 });
    expect(plan[4]).toEqual({ scale: 0.85, quality: 0.7 });
  });
  it('names the result .jpg', () => {
    expect(toJpegFileName('bai thi.PNG')).toBe('bai thi.jpg');
    expect(toJpegFileName('')).toBe('anh.jpg');
  });
  it('skips small JPEGs and only compresses raster photos', () => {
    expect(canSkipCompression({ type: 'image/jpeg', size: 1000 })).toBe(true);
    expect(canSkipCompression({ type: 'image/png', size: 1000 })).toBe(false);
    expect(isCompressibleImage({ type: 'image/webp' })).toBe(true);
    expect(isCompressibleImage({ type: 'application/pdf' })).toBe(false);
  });
});
