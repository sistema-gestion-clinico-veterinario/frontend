import { Injectable } from '@angular/core';

const MAX_IMAGE_DIMENSION = 1600;
const OPTIMIZATION_THRESHOLD_BYTES = 250 * 1024;
const WEBP_QUALITY = 0.82;
const OPTIMIZABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ImageDimensions {
  width: number;
  height: number;
}

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

/**
 * Optimiza únicamente imágenes de presentación (perfil, mascota y logotipo).
 * Los documentos e imágenes clínicas utilizan otro flujo y no pasan por aquí.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadOptimizerService {
  async optimize(file: File): Promise<File> {
    if (!OPTIMIZABLE_TYPES.has(file.type) || file.size <= OPTIMIZATION_THRESHOLD_BYTES) {
      return file;
    }

    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        const dimensions = calculateTargetDimensions(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        const context = canvas.getContext('2d', { alpha: true });
        if (!context) return file;

        context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
        const optimizedBlob = await this.toBlob(canvas);

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

  private toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
  }

  private webpFileName(fileName: string): string {
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'imagen';
    return `${baseName}.webp`;
  }
}
