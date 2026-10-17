import { Injectable } from '@angular/core';
import { ImageDimensions } from '../../models/ui/image-dimensions.model';

const MAX_IMAGE_DIMENSION = 1600;
const OPTIMIZATION_THRESHOLD_BYTES = 250 * 1024;
const WEBP_QUALITY = 0.82;
const MAX_LOGO_DIMENSION = 640;
const LOGO_WEBP_QUALITY = 0.80;
const OPTIMIZABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface ImageOptimizationProfile {
  maxDimension: number;
  minimumSizeBytes: number;
  quality: number;
}

const DEFAULT_PROFILE: ImageOptimizationProfile = {
  maxDimension: MAX_IMAGE_DIMENSION,
  minimumSizeBytes: OPTIMIZATION_THRESHOLD_BYTES,
  quality: WEBP_QUALITY
};

const LOGO_PROFILE: ImageOptimizationProfile = {
  maxDimension: MAX_LOGO_DIMENSION,
  minimumSizeBytes: 0,
  quality: LOGO_WEBP_QUALITY
};

export function calculateTargetDimensions(
  width: number,
  height: number,
  maxDimension = MAX_IMAGE_DIMENSION
): ImageDimensions {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}


@Injectable({ providedIn: 'root' })
export class ImageUploadOptimizerService {
  optimize(file: File): Promise<File> {
    return this.optimizeWithProfile(file, DEFAULT_PROFILE);
  }

  optimizeLogo(file: File): Promise<File> {
    return this.optimizeWithProfile(file, LOGO_PROFILE);
  }

  private async optimizeWithProfile(file: File, profile: ImageOptimizationProfile): Promise<File> {
    if (!OPTIMIZABLE_TYPES.has(file.type) || file.size <= profile.minimumSizeBytes) {
      return file;
    }

    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        const dimensions = calculateTargetDimensions(bitmap.width, bitmap.height, profile.maxDimension);
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        const context = canvas.getContext('2d', { alpha: true });
        if (!context) return file;

        context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
        const optimizedBlob = await this.toBlob(canvas, profile.quality);

        // No reemplazar el archivo cuando la conversión no produce una reducción real.
        if (!optimizedBlob || optimizedBlob.size >= file.size) return file;

        return new File([optimizedBlob], this.webpFileName(file.name), {
          type: 'image/webp',
          lastModified: file.lastModified
        });
      } finally {
        bitmap.close();
      }
    } catch {
      // La carga de una imagen válida no debe fallar por falta de soporte del navegador.
      return file;
    }
  }

  private toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
  }

  private webpFileName(fileName: string): string {
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'imagen';
    return `${baseName}.webp`;
  }
}
